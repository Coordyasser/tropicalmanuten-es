import { useState } from 'react'
import { Eye, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import type { AdminTicket } from '../../hooks/useAdminTickets'
import type { TicketStatus } from '../../types/database'

interface TicketTableProps {
  tickets: AdminTicket[]
  loading: boolean
  error: string | null
  onVerTicket: (ticket: AdminTicket) => void
  onRefresh: () => void
}

type Filter = 'all' | TicketStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',       label: 'Todos'      },
  { value: 'aberto',    label: 'Abertos'    },
  { value: 'pendente',  label: 'Pendentes'  },
  { value: 'concluido', label: 'Concluidos' },
]

function formatDate(d: string): string { const [y,m,day]=d.split('-'); return `${day}/${m}/${y}` }
function formatTime(t: string | null): string { return t ? t.slice(0,5) : '' }

export default function TicketTable({ tickets, loading, error, onVerTicket, onRefresh }: TicketTableProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={['px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                filter === f.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}>
              {f.label}
              {f.value !== 'all' && (
                <span className={['ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full',
                  f.value === 'aberto' ? 'bg-slate-100 text-slate-600' : f.value === 'pendente' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600',
                ].join(' ')}>
                  {tickets.filter(t => t.status === f.value).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span>{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={onRefresh} title="Atualizar"
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        {loading && (
          <div className="flex items-center justify-center h-64 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando chamados...</span>
          </div>
        )}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
            <WifiOff className="w-8 h-8" />
            <p className="text-sm">{error}</p>
            <button onClick={onRefresh} className="text-blue-600 text-sm underline">Tentar novamente</button>
          </div>
        )}
        {!loading && !error && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Data / Horario</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Empreendimento</th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Unidade / Bloco</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Tecnico</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Categoria</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Acao</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-slate-400">Nenhum chamado encontrado</td></tr>
              ) : filtered.map((ticket, i) => (
                <tr key={ticket.id}
                  className={['border-b border-slate-100 hover:bg-blue-50/40 transition-colors',
                    i % 2 === 0 ? '' : 'bg-slate-50/50'].join(' ')}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-slate-700 font-medium">{formatDate(ticket.scheduled_date)}</span>
                    {ticket.scheduled_time && (
                      <span className="block text-xs text-slate-400">{formatTime(ticket.scheduled_time)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-medium max-w-[180px] truncate">
                    {ticket.project?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-slate-700">{ticket.unidade ?? '—'}</span>
                    {ticket.bloco && <span className="text-slate-400 text-xs ml-1">Bl. {ticket.bloco}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate">{ticket.technician?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {ticket.categoria
                      ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{ticket.categoria}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={['inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
                      ticket.status === 'concluido' ? 'bg-emerald-100 text-emerald-700'
                      : ticket.status === 'pendente' ? 'bg-orange-100 text-orange-700'
                      : 'bg-slate-100 text-slate-600',
                    ].join(' ')}>
                      <span className={['w-1.5 h-1.5 rounded-full',
                        ticket.status === 'concluido' ? 'bg-emerald-500'
                        : ticket.status === 'pendente' ? 'bg-orange-400'
                        : 'bg-slate-400'].join(' ')} />
                      {ticket.status === 'concluido' ? 'Concluido' : ticket.status === 'pendente' ? 'Pendente' : 'Aberto'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => onVerTicket(ticket)}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium">
                      <Eye className="w-3.5 h-3.5" />
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
