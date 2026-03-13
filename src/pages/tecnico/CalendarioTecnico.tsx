import { useState } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, MapPin, Tag, X } from 'lucide-react'
import type { TicketWithRelations } from '../../hooks/useTickets'

interface CalendarioTecnicoProps {
  tickets: TicketWithRelations[]   // already filtered to tech_id = current user
  loading: boolean
  onVerTicket: (ticket: TicketWithRelations) => void
}

const WEEKDAYS   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
const MAX_VISIBLE = 2

function ticketLabel(t: TicketWithRelations): string {
  const project = t.project?.name ?? '—'
  const local   = [t.unidade, t.bloco ? `Bl.${t.bloco}` : null].filter(Boolean).join(' ')
  return local ? `${project} · ${local}` : project
}

function formatDateTitle(day: Date): string {
  const title = format(day, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
  return title.charAt(0).toUpperCase() + title.slice(1)
}

// ── StatusBadge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TicketWithRelations['status'] }) {
  const cfg = status === 'concluido'
    ? { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Concluido' }
    : status === 'pendente'
    ? { bg: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-400',  label: 'Pendente'  }
    : { bg: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400',   label: 'Aberto'    }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── DayTicketsModal ────────────────────────────────────────────────────────────
// Security: tickets prop is already scoped to the authenticated technician
// (filtered by tech_id at the Supabase query level in useTickets hook)
interface DayTicketsModalProps {
  day: Date
  tickets: TicketWithRelations[]
  onClose: () => void
  onVerTicket: (t: TicketWithRelations) => void
}

function DayTicketsModal({ day, tickets, onClose, onVerTicket }: DayTicketsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">Agenda</p>
            <h2 className="font-bold text-slate-800 text-base">{formatDateTitle(day)}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tickets.map(t => (
            <button
              key={t.id}
              onClick={() => { onVerTicket(t); onClose() }}
              className="w-full text-left bg-slate-50 hover:bg-slate-100 active:scale-[0.98] rounded-xl px-4 py-3 transition-all border border-slate-100"
            >
              {/* Location */}
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold text-sm text-slate-800 truncate">
                  {t.project?.name ?? '—'}
                  {t.unidade && <span className="font-normal text-slate-400"> · Unid. {t.unidade}</span>}
                  {t.bloco   && <span className="font-normal text-slate-400"> / Bl. {t.bloco}</span>}
                </span>
              </div>

              {/* Description */}
              {t.description && (
                <p className="text-xs text-slate-500 line-clamp-2 mb-2">{t.description}</p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={t.status} />
                {t.categoria && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <Tag className="w-3 h-3" /> {t.categoria}
                  </span>
                )}
                {t.scheduled_time && (
                  <span className="ml-auto text-[11px] text-slate-400">
                    {t.scheduled_time.slice(0, 5)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-400 text-center">
            {tickets.length} chamado{tickets.length !== 1 ? 's' : ''} neste dia
          </p>
        </div>
      </div>
    </div>
  )
}

// ── CalendarioTecnico ──────────────────────────────────────────────────────────
export default function CalendarioTecnico({ tickets, loading, onVerTicket }: CalendarioTecnicoProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [dayModal, setDayModal]         = useState<{ day: Date; tickets: TicketWithRelations[] } | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 0 })
  const days       = eachDayOfInterval({ start: calStart, end: calEnd })
  const today      = new Date()

  function ticketsForDay(day: Date): TicketWithRelations[] {
    const iso = format(day, 'yyyy-MM-dd')
    return tickets.filter(t => t.scheduled_date === iso)
  }

  function handleDayClick(day: Date, dayTickets: TicketWithRelations[]) {
    if (dayTickets.length === 0) return
    setDayModal({ day, tickets: dayTickets })
  }

  const monthTitle  = format(currentMonth, 'MMMM yyyy', { locale: ptBR })
  const capitalised = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Horizontal scroll wrapper for mobile */}
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">

            {/* ── Calendar header ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="font-bold text-slate-800 text-base">{capitalised}</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200">
                  Hoje
                </button>
                <button
                  onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                  className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Weekday labels ── */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
              {WEEKDAYS.map(d => (
                <div key={d} className="py-2 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* ── Day grid ── */}
            {loading ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                Carregando chamados...
              </div>
            ) : (
              <div className="grid grid-cols-7 divide-x divide-slate-100">
                {days.map((day, idx) => {
                  const dayTickets     = ticketsForDay(day)
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isToday        = isSameDay(day, today)
                  const visible        = dayTickets.slice(0, MAX_VISIBLE)
                  const overflow       = dayTickets.length - visible.length
                  const isLastCol      = (idx + 1) % 7 === 0
                  const hasTickets     = dayTickets.length > 0

                  return (
                    <div
                      key={idx}
                      onClick={() => handleDayClick(day, dayTickets)}
                      className={[
                        'min-h-[80px] p-1.5 border-b border-slate-100 flex flex-col gap-0.5',
                        !isCurrentMonth ? 'bg-slate-50/60' : 'bg-white',
                        isLastCol ? 'border-r-0' : '',
                        hasTickets ? 'cursor-pointer hover:bg-blue-50/20 transition-colors' : '',
                      ].join(' ')}>

                      {/* Day number */}
                      <div className="flex justify-end mb-0.5">
                        <span className={[
                          'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium',
                          isToday
                            ? 'bg-brand-red text-white font-bold'
                            : isCurrentMonth
                              ? 'text-slate-700'
                              : 'text-slate-300',
                        ].join(' ')}>
                          {format(day, 'd')}
                        </span>
                      </div>

                      {/* Ticket pills */}
                      <div className="flex flex-col gap-0.5">
                        {visible.map(t => (
                          <div
                            key={t.id}
                            title={ticketLabel(t)}
                            className={[
                              'w-full text-[10px] font-medium px-1 py-[2px] rounded truncate leading-tight',
                              t.status === 'concluido'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'pendente'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-blue-100 text-blue-800',
                            ].join(' ')}>
                            {ticketLabel(t)}
                          </div>
                        ))}

                        {/* Overflow indicator */}
                        {overflow > 0 && (
                          <div className="text-[9px] text-brand-red font-semibold pl-0.5 mt-0.5">
                            +{overflow} chamado{overflow > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

          </div>{/* end min-w */}
        </div>{/* end overflow-x-auto */}

        {/* ── Legend ── */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex-wrap">
          {[
            { label: 'Aberto',    bg: 'bg-blue-100',    text: 'text-blue-800'    },
            { label: 'Pendente',  bg: 'bg-orange-100',  text: 'text-orange-800'  },
            { label: 'Concluido', bg: 'bg-emerald-100', text: 'text-emerald-800' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-sm ${l.bg}`} />
              <span className={`text-[10px] font-medium ${l.text}`}>{l.label}</span>
            </div>
          ))}
          <span className="ml-auto text-[10px] text-slate-400">Toque no dia para ver todos</span>
        </div>
      </div>

      {/* ── Day modal ── */}
      {dayModal && (
        <DayTicketsModal
          day={dayModal.day}
          tickets={dayModal.tickets}
          onClose={() => setDayModal(null)}
          onVerTicket={onVerTicket}
        />
      )}
    </>
  )
}
