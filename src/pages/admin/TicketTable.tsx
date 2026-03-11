import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Eye, Loader2, RefreshCw, WifiOff } from 'lucide-react'
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
function formatTime(t: string | null): string { return t ? t.slice(0, 5) : '' }

function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={['inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full',
      status === 'concluido' ? 'bg-emerald-100 text-emerald-700'
      : status === 'pendente' ? 'bg-orange-100 text-orange-700'
      : 'bg-slate-100 text-slate-600',
    ].join(' ')}>
      <span className={['w-1.5 h-1.5 rounded-full',
        status === 'concluido' ? 'bg-emerald-500'
        : status === 'pendente' ? 'bg-orange-400'
        : 'bg-slate-400'].join(' ')} />
      {status === 'concluido' ? 'Concluido' : status === 'pendente' ? 'Pendente' : 'Aberto'}
    </span>
  )
}

interface LocationGroup {
  key: string
  projectName: string
  unidade: string | null
  bloco: string | null
  tickets: AdminTicket[]
}

function groupTickets(tickets: AdminTicket[]): LocationGroup[] {
  const map = new Map<string, LocationGroup>()
  for (const t of tickets) {
    const key = `${t.project?.name ?? '—'}|${t.bloco ?? ''}|${t.unidade ?? ''}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        projectName: t.project?.name ?? '—',
        unidade: t.unidade,
        bloco: t.bloco,
        tickets: [],
      })
    }
    map.get(key)!.tickets.push(t)
  }
  return Array.from(map.values())
}

export default function TicketTable({ tickets, loading, error, onVerTicket, onRefresh }: TicketTableProps) {
  const [filter, setFilter]       = useState<Filter>('all')
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)
  const groups   = groupTickets(filtered)

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Filters bar ── */}
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
                  f.value === 'aberto'    ? 'bg-slate-100 text-slate-600'
                  : f.value === 'pendente'  ? 'bg-orange-100 text-orange-600'
                  : 'bg-emerald-100 text-emerald-600',
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

      {/* ── Table ── */}
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
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 font-semibold text-slate-600">Local</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Qtd</th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Data / Horario</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Categoria</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Tecnico</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Acao</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    Nenhum chamado encontrado
                  </td>
                </tr>
              ) : groups.map(group => {
                const isOpen = openGroups.has(group.key)
                const locationLabel = [
                  group.unidade ? `Unid. ${group.unidade}` : null,
                  group.bloco   ? `Bl. ${group.bloco}`     : null,
                ].filter(Boolean).join(' · ')
                const counts = {
                  aberto:    group.tickets.filter(t => t.status === 'aberto').length,
                  pendente:  group.tickets.filter(t => t.status === 'pendente').length,
                  concluido: group.tickets.filter(t => t.status === 'concluido').length,
                }
                return (
                  <React.Fragment key={group.key}>

                    {/* ── Master row ── */}
                    <tr
                      onClick={() => toggleGroup(group.key)}
                      className="border-b border-slate-200 bg-slate-50/80 hover:bg-blue-50/50 cursor-pointer transition-colors select-none">
                      <td className="px-4 py-3 text-slate-400">
                        {isOpen
                          ? <ChevronDown  className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{group.projectName}</p>
                        {locationLabel && (
                          <p className="text-xs text-slate-400 mt-0.5">{locationLabel}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                          {group.tickets.length}
                        </span>
                      </td>
                      <td className="px-4 py-3" colSpan={4}>
                        <div className="flex gap-1.5 flex-wrap">
                          {counts.aberto    > 0 && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                              {counts.aberto} aberto{counts.aberto > 1 ? 's' : ''}
                            </span>
                          )}
                          {counts.pendente  > 0 && (
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                              {counts.pendente} pendente{counts.pendente > 1 ? 's' : ''}
                            </span>
                          )}
                          {counts.concluido > 0 && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                              {counts.concluido} concluido{counts.concluido > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" />
                    </tr>

                    {/* ── Detail rows ── */}
                    {isOpen && group.tickets.map((ticket, i) => (
                      <tr key={ticket.id}
                        className={['border-b border-slate-100 hover:bg-blue-50/30 transition-colors',
                          i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'].join(' ')}>
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5 text-slate-300 text-xs pl-8">↳</td>
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="text-slate-700 font-medium">{formatDate(ticket.scheduled_date)}</span>
                          {ticket.scheduled_time && (
                            <span className="block text-xs text-slate-400">{formatTime(ticket.scheduled_time)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {ticket.categoria
                            ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{ticket.categoria}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 text-sm max-w-[140px] truncate">
                          {ticket.technician?.name ?? '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={ticket.status} />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={e => { e.stopPropagation(); onVerTicket(ticket) }}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium">
                            <Eye className="w-3.5 h-3.5" />
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}

                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
