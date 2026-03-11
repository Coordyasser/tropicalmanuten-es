import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Eye, Loader2, Pencil, RefreshCw, Search, Trash2, WifiOff, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { AdminTicket } from '../../hooks/useAdminTickets'
import type { TicketStatus } from '../../types/database'
import EditTicketModal from './EditTicketModal'

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
      map.set(key, { key, projectName: t.project?.name ?? '—', unidade: t.unidade, bloco: t.bloco, tickets: [] })
    }
    map.get(key)!.tickets.push(t)
  }
  return Array.from(map.values())
}

function applyFilters(
  tickets: AdminTicket[],
  statusFilter: Filter,
  search: string,
  dateFrom: string,
  dateTo: string,
): AdminTicket[] {
  let result = statusFilter === 'all' ? tickets : tickets.filter(t => t.status === statusFilter)

  const q = search.trim().toLowerCase()
  if (q) {
    result = result.filter(t =>
      (t.project?.name    ?? '').toLowerCase().includes(q) ||
      (t.unidade          ?? '').toLowerCase().includes(q) ||
      (t.bloco            ?? '').toLowerCase().includes(q) ||
      (t.technician?.name ?? '').toLowerCase().includes(q) ||
      (t.categoria        ?? '').toLowerCase().includes(q)
    )
  }

  if (dateFrom) result = result.filter(t => t.scheduled_date >= dateFrom)
  if (dateTo)   result = result.filter(t => t.scheduled_date <= dateTo)

  return result
}

export default function TicketTable({ tickets, loading, error, onVerTicket, onRefresh }: TicketTableProps) {
  const [filter,          setFilter]          = useState<Filter>('all')
  const [search,          setSearch]          = useState('')
  const [dateFrom,        setDateFrom]        = useState('')
  const [dateTo,          setDateTo]          = useState('')
  const [openGroups,      setOpenGroups]      = useState<Set<string>>(new Set())
  const [editTicket,      setEditTicket]      = useState<AdminTicket | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting,        setDeleting]        = useState(false)

  const filtered = applyFilters(tickets, filter, search, dateFrom, dateTo)
  const groups   = groupTickets(filtered)

  const hasExtraFilters = search.trim() !== '' || dateFrom !== '' || dateTo !== ''

  function clearExtraFilters() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
  }

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    await supabase.from('tickets').delete().eq('id', id)
    setConfirmDeleteId(null)
    setDeleting(false)
    onRefresh()
  }

  return (
    <div className="flex flex-col h-full gap-3">

      {/* ── Search + Date range ── */}
      <div className="flex gap-2 flex-wrap">

        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por empreendimento, unidade, técnico, categoria..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date from */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-400 font-medium whitespace-nowrap">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition"
          />
        </div>

        {/* Date to */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-400 font-medium whitespace-nowrap">Ate</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition"
          />
        </div>

        {/* Clear extra filters */}
        {hasExtraFilters && (
          <button onClick={clearExtraFilters}
            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-500 hover:text-red-500 hover:border-red-200 transition-colors">
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* ── Status pills + count ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={['px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                filter === f.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}>
              {f.label}
              {f.value !== 'all' && (
                <span className={['ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full',
                  f.value === 'aberto'   ? 'bg-slate-100 text-slate-600'
                  : f.value === 'pendente' ? 'bg-orange-100 text-orange-600'
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
                <th className="px-4 py-3 font-semibold text-slate-600 text-center whitespace-nowrap">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    {hasExtraFilters || filter !== 'all'
                      ? 'Nenhum chamado encontrado para os filtros aplicados'
                      : 'Nenhum chamado encontrado'}
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
                        {locationLabel && <p className="text-xs text-slate-400 mt-0.5">{locationLabel}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                          {group.tickets.length}
                        </span>
                      </td>
                      <td className="px-4 py-3" colSpan={4}>
                        <div className="flex gap-1.5 flex-wrap">
                          {counts.aberto > 0 && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                              {counts.aberto} aberto{counts.aberto > 1 ? 's' : ''}
                            </span>
                          )}
                          {counts.pendente > 0 && (
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
                          {confirmDeleteId === ticket.id ? (
                            /* ── Inline delete confirm ── */
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-xs text-red-600 font-medium whitespace-nowrap">Excluir?</span>
                              <button disabled={deleting} onClick={e => { e.stopPropagation(); handleDelete(ticket.id) }}
                                className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 px-2 py-1 rounded-lg transition-colors">
                                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sim'}
                              </button>
                              <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                                className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
                                Nao
                              </button>
                            </div>
                          ) : (
                            /* ── Normal action buttons ── */
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={e => { e.stopPropagation(); onVerTicket(ticket) }}
                                title="Ver detalhes"
                                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); setEditTicket(ticket) }}
                                title="Editar"
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(ticket.id) }}
                                title="Excluir"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
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

      <EditTicketModal
        ticket={editTicket}
        onClose={() => setEditTicket(null)}
        onSuccess={() => { setEditTicket(null); onRefresh() }}
      />
    </div>
  )
}
