import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, MapPin, Clock } from 'lucide-react'
import type { TicketWithRelations } from '../hooks/useTickets'

interface TicketCardProps {
  ticket: TicketWithRelations
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function formatTime(t: string | null): string { return t ? t.slice(0, 5) : '' }

export default function TicketCard({ ticket }: TicketCardProps) {
  const navigate = useNavigate()
  const isPending = ticket.status === 'aberto'

  function handleClick() {
    if (isPending) navigate(`/tecnico/ticket/${ticket.id}`)
  }

  return (
    <div
      role={isPending ? 'button' : undefined}
      tabIndex={isPending ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={e => { if (isPending && (e.key === 'Enter' || e.key === ' ')) handleClick() }}
      className={[
        'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all',
        'flex items-stretch',
        isPending
          ? 'active:scale-[0.98] cursor-pointer hover:shadow-md hover:border-slate-200'
          : 'opacity-80',
      ].join(' ')}
    >
      {/* Accent border */}
      <div className={`w-1 shrink-0 ${isPending ? 'bg-orange-400' : 'bg-emerald-400'}`} />

      {/* Content */}
      <div className="flex-1 p-4 min-w-0">
        {/* Row 1: date + badge */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            <span>{formatDate(ticket.scheduled_date)}</span>
            {ticket.scheduled_time && (
              <span className="flex items-center gap-0.5 text-slate-400">
                <Clock className="w-3 h-3" />{formatTime(ticket.scheduled_time)}
              </span>
            )}
          </div>
          <span
            className={[
              'text-[11px] font-semibold px-2 py-0.5 rounded-full',
              isPending
                ? 'bg-orange-100 text-orange-600'
                : 'bg-emerald-100 text-emerald-600',
            ].join(' ')}
          >
            {isPending ? 'Pendente' : 'Concluido'}
          </span>
        </div>

        {/* Row 2: location */}
        <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-sm mb-1">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">
            {ticket.project?.name ?? '—'}
            {ticket.unidade && (
              <span className="text-slate-400 font-normal"> — Unid. {ticket.unidade}</span>
            )}
            {ticket.bloco && (
              <span className="text-slate-400 font-normal"> / Bl. {ticket.bloco}</span>
            )}
          </span>
        </div>

        {/* Row 3: categoria + description */}
        {ticket.categoria && (
          <span className="inline-block text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full mb-1.5">
            {ticket.categoria}
          </span>
        )}
        <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">
          {ticket.description}
        </p>
      </div>

      {/* Arrow for clickable cards */}
      {isPending && (
        <div className="flex items-center pr-3 pl-1 text-slate-300">
          <ChevronRight className="w-5 h-5" />
        </div>
      )}
    </div>
  )
}
