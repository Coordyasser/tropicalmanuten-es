import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, CalendarDays, ChevronRight, ClipboardList,
  Clock, LogOut, WifiOff,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTickets } from '../../hooks/useTickets'
import type { TicketWithRelations } from '../../hooks/useTickets'
import type { TicketStatus, TicketType } from '../../types/database'
import CalendarioTecnico from './CalendarioTecnico'

// ── Types ─────────────────────────────────────────────────────────────────────
interface TicketGroup {
  key: string
  projectId: string
  projectName: string
  bloco: string | null
  unidade: string | null
  tickets: TicketWithRelations[]       // sorted newest first
  counts: Record<TicketStatus, number>
  latestDate: string
  latestTime: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sortDesc(a: TicketWithRelations, b: TicketWithRelations): number {
  const da = a.scheduled_date + (a.scheduled_time ?? '')
  const db = b.scheduled_date + (b.scheduled_time ?? '')
  return db.localeCompare(da)
}

function groupTickets(tickets: TicketWithRelations[]): TicketGroup[] {
  const map = new Map<string, TicketGroup>()
  // tickets already sorted newest first when called
  for (const t of tickets) {
    const key = `${t.project_id}|${t.bloco ?? ''}|${t.unidade ?? ''}|${t.os_number ?? ''}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        projectId:   t.project_id,
        projectName: t.project?.name ?? '—',
        bloco:       t.bloco,
        unidade:     t.unidade,
        tickets:     [],
        counts:      { aberto: 0, pendente: 0, concluido: 0 },
        latestDate:  t.scheduled_date,
        latestTime:  t.scheduled_time ?? null,
      })
    }
    const g = map.get(key)!
    g.tickets.push(t)
    g.counts[t.status]++
    if (t.scheduled_date > g.latestDate ||
        (t.scheduled_date === g.latestDate && (t.scheduled_time ?? '') > (g.latestTime ?? ''))) {
      g.latestDate = t.scheduled_date
      g.latestTime = t.scheduled_time ?? null
    }
  }
  return Array.from(map.values())
}

function formatDate(d: string): string {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

// ── TicketTypeBadge ───────────────────────────────────────────────────────────
function TicketTypeBadge({ type }: { type: TicketType | null }) {
  if (!type) return null
  return type === 'vistoria'
    ? <span className="inline-flex items-center text-[10px] font-semibold bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">Vistoria</span>
    : <span className="inline-flex items-center text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Manutenção</span>
}

// ── GroupCard ─────────────────────────────────────────────────────────────────
function GroupCard({
  group,
  onClick,
  variant,
}: { group: TicketGroup; onClick: () => void; variant: 'ativas' | 'concluidas' }) {
  const isPending  = variant === 'ativas'
  const mostRecent = group.tickets[0] // sorted newest first

  const hasPendente = group.counts.pendente > 0
  const hasAberto   = group.counts.aberto   > 0
  const total       = group.tickets.length

  const stripColor = isPending
    ? (hasPendente ? 'bg-orange-400' : 'bg-slate-400')
    : 'bg-emerald-400'

  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex items-stretch cursor-pointer hover:shadow-md hover:border-slate-200 active:scale-[0.98] transition-all"
    >
      <div className={`w-1 shrink-0 ${stripColor}`} />

      <div className="flex-1 p-4 min-w-0">

        {/* Row 1: location */}
        <div className="flex items-center gap-2 mb-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-800 font-semibold text-sm truncate">
            {group.projectName}
            {group.unidade && <span className="text-slate-400 font-normal"> — Unid. {group.unidade}</span>}
            {group.bloco   && <span className="text-slate-400 font-normal"> / Bl. {group.bloco}</span>}
          </span>
          {total > 1 && (
            <span className="shrink-0 ml-auto text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
              {total} chamados
            </span>
          )}
        </div>

        {/* Row 2: description of most recent ticket */}
        {mostRecent?.description && (
          <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 mb-2">
            {mostRecent.description}
          </p>
        )}

        {/* Row 3: status badges + date */}
        <div className="flex items-center gap-2 flex-wrap">
          {isPending ? (
            <>
              {hasAberto && (
                <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {group.counts.aberto} Aberto{group.counts.aberto > 1 ? 's' : ''}
                </span>
              )}
              {hasPendente && (
                <span className="text-[11px] font-semibold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                  {group.counts.pendente} Pendente{group.counts.pendente > 1 ? 's' : ''}
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">
              {group.counts.concluido} Concluido{group.counts.concluido > 1 ? 's' : ''}
            </span>
          )}
          <TicketTypeBadge type={mostRecent?.ticket_type ?? null} />
          <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto">
            <Clock className="w-3 h-3" />
            {formatDate(group.latestDate)}
            {group.latestTime && ` às ${group.latestTime.slice(0, 5)}`}
          </span>
        </div>

      </div>

      <div className="flex items-center pr-3 pl-1 text-slate-300">
        <ChevronRight className="w-5 h-5" />
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 flex overflow-hidden animate-pulse h-24">
      <div className="w-1 bg-slate-200 shrink-0" />
      <div className="flex-1 p-4 space-y-2">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-2/3" />
        <div className="h-3 bg-slate-200 rounded w-full" />
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
type Tab = 'ativas' | 'concluidas' | 'calendario'

export default function DashboardTecnico() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const { tickets, loading, error, refetch } = useTickets()
  const [activeTab, setActiveTab] = useState<Tab>('ativas')

  // ── Ativas groups: non-concluded, grouped by location, newest first ────────
  const ativasGroups = useMemo(() => {
    const pending = [...tickets].filter(t => t.status !== 'concluido').sort(sortDesc)
    return groupTickets(pending).sort((a, b) => {
      const da = a.latestDate + (a.latestTime ?? '')
      const db = b.latestDate + (b.latestTime ?? '')
      return db.localeCompare(da)
    })
  }, [tickets])

  // ── Concluidas groups: concluded only, newest first ───────────────────────
  const concluidasGroups = useMemo(() => {
    const concluded = [...tickets].filter(t => t.status === 'concluido').sort(sortDesc)
    return groupTickets(concluded).sort((a, b) => {
      const da = a.latestDate + (a.latestTime ?? '')
      const db = b.latestDate + (b.latestTime ?? '')
      return db.localeCompare(da)
    })
  }, [tickets])

  const pendingCount = tickets.filter(t => t.status !== 'concluido').length

  // ── Navigation ───────────────────────────────────────────────────────────
  function getLocationTickets(ticket: TicketWithRelations): TicketWithRelations[] {
    const key = `${ticket.project_id}|${ticket.bloco ?? ''}|${ticket.unidade ?? ''}|${ticket.os_number ?? ''}`
    return [...tickets]
      .filter(t => `${t.project_id}|${t.bloco ?? ''}|${t.unidade ?? ''}|${t.os_number ?? ''}` === key)
      .sort(sortDesc)
  }

  function handleGroupClick(group: TicketGroup) {
    navigate('/tecnico/baixa', { state: { tickets: [...group.tickets].sort(sortDesc) } })
  }

  function handleCalendarTicketClick(ticket: TicketWithRelations) {
    navigate('/tecnico/baixa', { state: { tickets: getLocationTickets(ticket) } })
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* Header */}
      <header className="bg-gradient-to-r from-brand-red to-brand-red-dark text-white px-4 pt-10 pb-6 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo%20tropical.jpg.jpeg" alt="Tropical" className="w-9 h-9 rounded-xl object-cover shrink-0" />
            <div>
              <p className="text-white/60 text-xs font-medium uppercase tracking-widest leading-none mb-0.5">Ola,</p>
              <h1 className="text-lg font-bold leading-tight">{profile?.name ?? 'Tecnico'}</h1>
            </div>
          </div>
          <button onClick={signOut}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-3 py-2 text-xs font-medium">
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
        {!loading && pendingCount > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-yellow animate-pulse" />
            <span className="text-xs font-medium text-white/80">
              {pendingCount} chamado{pendingCount > 1 ? 's' : ''} em aberto
            </span>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-slate-100">
          <button onClick={() => setActiveTab('ativas')}
            className={['flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
              activeTab === 'ativas' ? 'bg-brand-red text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}>
            Pendentes
            {ativasGroups.length > 0 && (
              <span className={['ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full',
                activeTab === 'ativas' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600',
              ].join(' ')}>
                {ativasGroups.length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('concluidas')}
            className={['flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
              activeTab === 'concluidas' ? 'bg-brand-red text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}>
            Concluidas
          </button>
          <button onClick={() => setActiveTab('calendario')}
            className={['flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1',
              activeTab === 'calendario' ? 'bg-brand-red text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}>
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Agenda</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-4 pb-8">
        {activeTab === 'calendario' ? (
          <CalendarioTecnico
            tickets={tickets}
            loading={loading}
            onVerTicket={handleCalendarTicketClick}
          />
        ) : (
          <div className="space-y-3">

            {error && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <WifiOff className="w-10 h-10 text-slate-300" />
                <p className="text-slate-500 text-sm">{error}</p>
                <button onClick={refetch} className="text-brand-red text-sm font-medium underline">
                  Tentar novamente
                </button>
              </div>
            )}

            {loading && !error && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}

            {!loading && !error && activeTab === 'ativas' && (
              <>
                {ativasGroups.map(group => (
                  <GroupCard
                    key={group.key}
                    group={group}
                    variant="ativas"
                    onClick={() => handleGroupClick(group)}
                  />
                ))}
                {ativasGroups.length === 0 && (
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                      <ClipboardList className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-700 font-semibold text-sm">Nenhum chamado pendente</p>
                    <p className="text-slate-400 text-xs">Voce esta em dia!</p>
                  </div>
                )}
              </>
            )}

            {!loading && !error && activeTab === 'concluidas' && (
              <>
                {concluidasGroups.map(group => (
                  <GroupCard
                    key={group.key}
                    group={group}
                    variant="concluidas"
                    onClick={() => handleGroupClick(group)}
                  />
                ))}
                {concluidasGroups.length === 0 && (
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                      <ClipboardList className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-700 font-semibold text-sm">Nenhum chamado concluido</p>
                    <p className="text-slate-400 text-xs">Chamados finalizados aparecao aqui.</p>
                  </div>
                )}
              </>
            )}

          </div>
        )}
      </main>
    </div>
  )
}
