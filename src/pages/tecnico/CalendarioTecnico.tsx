import { useState } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TicketWithRelations } from '../../hooks/useTickets'

interface CalendarioTecnicoProps {
  tickets: TicketWithRelations[]
  loading: boolean
  onVerTicket: (ticket: TicketWithRelations) => void
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

function ticketLabel(t: TicketWithRelations): string {
  const project = t.project?.name ?? '—'
  const local   = [t.unidade, t.bloco ? `Bl.${t.bloco}` : null].filter(Boolean).join(' ')
  return local ? `${project} · ${local}` : project
}

export default function CalendarioTecnico({ tickets, loading, onVerTicket }: CalendarioTecnicoProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

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

  const monthTitle  = format(currentMonth, 'MMMM yyyy', { locale: ptBR })
  const capitalised = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

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
            const visible        = dayTickets.slice(0, 2)
            const overflow       = dayTickets.length - visible.length
            const isLastCol      = (idx + 1) % 7 === 0

            return (
              <div
                key={idx}
                className={[
                  'min-h-[80px] p-1.5 border-b border-slate-100 flex flex-col gap-0.5',
                  !isCurrentMonth ? 'bg-slate-50/60' : 'bg-white',
                  isLastCol ? 'border-r-0' : '',
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
                    <button
                      key={t.id}
                      onClick={() => onVerTicket(t)}
                      title={ticketLabel(t)}
                      className={[
                        'w-full text-left text-[10px] font-medium px-1 py-[2px] rounded truncate leading-tight transition-all hover:brightness-95 active:scale-[0.98]',
                        t.status === 'concluido'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.status === 'pendente'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800',
                      ].join(' ')}>
                      {ticketLabel(t)}
                    </button>
                  ))}
                  {overflow > 0 && (
                    <p className="text-[9px] text-slate-400 font-medium pl-0.5">
                      +{overflow} mais
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
      </div>
    </div>
  )
}
