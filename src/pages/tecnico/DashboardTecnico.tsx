import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, CalendarDays, ChevronRight, ClipboardList,
  Clock, Lock, LogOut, WifiOff,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTickets } from '../../hooks/useTickets'
import type { TicketWithRelations } from '../../hooks/useTickets'
import type { TicketStatus } from '../../types/database'
import CalendarioTecnico from './CalendarioTecnico'

// ── Types ─────────────────────────────────────────────────────────────────────
interface TicketGroup {
  key: string
  projectId: string
  projectName: string
  bloco: string | null
  unidade: string | null
  tickets: TicketWithRelations[]
  counts: Record<TicketStatus, number>
  earliestDate: string
  latestDate: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function groupTickets(tickets: TicketWithRelations[]): TicketGroup[] {
  const map = new Map<string, TicketGroup>()
  for (const t of tickets) {
    const key = `${t.project_id}|${t.bloco ?? ''}|${t.unidade ?? ''}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        projectId:   t.project_id,
        projectName: t.project?.name ?? '—',
        bloco:       t.bloco,
        unidade:     t.unidade,
        tickets:     [],
        counts:      { aberto: 0, pendente: 0, concluido: 0 },
        earliestDate: t.scheduled_date,
        latestDate:   t.scheduled_date,
      })
    }
    const g = map.get(key)!
    g.tickets.push(t)
    g.counts[t.status]++
    if (t.scheduled_date < g.earliestDate) g.earliestDate = t.scheduled_date
    if (t.scheduled_date > g.latestDate)   g.latestDate   = t.scheduled_date
  }
  return Array.from(map.values())
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function sortDesc(a: TicketWithRelations, b: TicketWithRelations): number {
  const da = a.scheduled_date + (a.scheduled_time ?? '')
  const db = b.scheduled_date + (b.scheduled_time ?? '')
  return db.localeCompare(da)
}

// ── TicketFlatCard (ativas tab — individual tickets) ──────────────────────────
function TicketFlatCard({
  ticket, isLocked, onPress,
}: { ticket: TicketWithRelations; isLocked: boolean; onPress: () => void }) {
  const isPendente = ticket.status === 'pendente'

  return (
    <div
      role={isLocked ? undefined : 'button'}
      tabIndex={isLocked ? undefined : 0}
      onClick={isLocked ? undefined : onPress}
      onKeyDown={isLocked ? undefined : (e => { if (e.key === 'Enter' || e.key === ' ') onPress() })}
      className={[
        'bg-white rounded-2xl shadow-sm border overflow-hidden flex items-stretch transition-all',
        isLocked
          ? 'border-amber-100 opacity-60 cursor-default'
          : 'border-slate-100 cursor-pointer hover:shadow-md hover:border-slate-200 active:scale-[0.98]',
      ].join(' ')}
    >
      {/* Left color strip */}
      <div className={`w-1 shrink-0 ${isLocked ? 'bg-amber-200' : isPendente ? 'bg-orange-400' : 'bg-slate-400'}`} />

      <div className="flex-1 p-4 min-w-0">
        {/* Row 1: location + status badge */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-800 font-semibold text-sm truncate">
              {ticket.project?.name ?? '—'}
              {ticket.unidade && <span className="text-slate-400 font-normal"> — Unid. {ticket.unidade}</span>}
              {ticket.bloco   && <span className="text-slate-400 font-normal"> / Bl. {ticket.bloco}</span>}
            </span>
          </div>
          {isLocked ? (
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3" /> Na fila
            </span>
          ) : (
            <span className={['shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full',
              isPendente ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600',
            ].join(' ')}>
              {isPendente ? 'Pendente' : 'Aberto'}
            </span>
          )}
        </div>

        {/* Row 2: description */}
        <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 mb-2">
          {ticket.description}
        </p>

        {/* Row 3: date + category */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(ticket.scheduled_date)}
            {ticket.scheduled_time && ` às ${ticket.scheduled_time.slice(0, 5)}`}
          </span>
          {ticket.categoria && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full truncate max-w-[140px]">
              {ticket.categoria}
            </span>
          )}
        </div>

        {/* Lock message */}
        {isLocked && (
          <p className="mt-2 text-[10px] text-amber-600 font-medium">
            Conclua o chamado mais recente deste local para desbloquear
          </p>
        )}
      </div>

      {!isLocked && (
        <div className="flex items-center pr-3 pl-1 text-slate-300">
          <ChevronRight className="w-5 h-5" />
        </div>
      )}
    </div>
  )
}

// ── GroupCard (concluidas tab — grouped by location) ──────────────────────────
function GroupCard({ group, onClick }: { group: TicketGroup; onClick: () => void }) {
  return (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex items-stretch cursor-pointer hover:shadow-md hover:border-slate-200 active:scale-[0.98] transition-all"
    >
      <div className="w-1 shrink-0 bg-emerald-400" />
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-800 font-semibold text-sm truncate">
            {group.projectName}
            {group.unidade && <span className="text-slate-400 font-normal"> — Unid. {group.unidade}</span>}
            {group.bloco   && <span className="text-slate-400 font-normal"> / Bl. {group.bloco}</span>}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">
            {group.counts.concluido} Concluido{group.counts.concluido > 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-slate-400 text-xs">
          {group.tickets.length} chamado{group.tickets.length > 1 ? 's' : ''} · {formatDate(group.latestDate)}
        </p>
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

  // ── Ativas: flat list, newest first ───────────────────────────────────────
  const ativasFlat = useMemo(() =>
    tickets
      .filter(t => t.status !== 'concluido')
      .sort(sortDesc),
    [tickets])

  // ── Per-location most recent non-concluded ticket ────────────────────────
  // ativasFlat is already newest-first, so first occurrence per location = most recent
  const mostRecentByLocation = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of ativasFlat) {
      const key = `${t.project_id}|${t.bloco ?? ''}|${t.unidade ?? ''}`
      if (!map.has(key)) map.set(key, t.id)
    }
    return map
  }, [ativasFlat])

  // ── Concluidas: groups, newest first ────────────────────────────────────
  const concluidasGroups = useMemo(() => {
    const concluded = tickets.filter(t => t.status === 'concluido')
    return groupTickets(concluded).sort((a, b) => b.latestDate.localeCompare(a.latestDate))
  }, [tickets])

  const pendingCount = ativasFlat.length

  // ── Navigation helpers ───────────────────────────────────────────────────
  function getLocationTickets(ticket: TicketWithRelations): TicketWithRelations[] {
    const key = `${ticket.project_id}|${ticket.bloco ?? ''}|${ticket.unidade ?? ''}`
    return tickets
      .filter(t => `${t.project_id}|${t.bloco ?? ''}|${t.unidade ?? ''}` === key)
      .sort(sortDesc)
  }

  function handleTicketClick(ticket: TicketWithRelations) {
    navigate('/tecnico/baixa', { state: { tickets: getLocationTickets(ticket) } })
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
            {ativasFlat.length > 0 && (
              <span className={['ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full',
                activeTab === 'ativas' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600',
              ].join(' ')}>
                {ativasFlat.length}
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

            {/* Error */}
            {error && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <WifiOff className="w-10 h-10 text-slate-300" />
                <p className="text-slate-500 text-sm">{error}</p>
                <button onClick={refetch} className="text-brand-red text-sm font-medium underline">
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Skeleton */}
            {loading && !error && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}

            {/* ── Ativas: flat list of individual tickets, newest first ─────── */}
            {!loading && !error && activeTab === 'ativas' && (
              <>
                {ativasFlat.map(ticket => {
                  const locKey   = `${ticket.project_id}|${ticket.bloco ?? ''}|${ticket.unidade ?? ''}`
                  const isLocked = mostRecentByLocation.get(locKey) !== ticket.id
                  return (
                    <TicketFlatCard
                      key={ticket.id}
                      ticket={ticket}
                      isLocked={isLocked}
                      onPress={() => handleTicketClick(ticket)}
                    />
                  )
                })}
                {ativasFlat.length === 0 && (
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

            {/* ── Concluidas: grouped by location, newest first ────────────── */}
            {!loading && !error && activeTab === 'concluidas' && (
              <>
                {concluidasGroups.map(group => (
                  <GroupCard key={group.key} group={group} onClick={() => handleGroupClick(group)} />
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
