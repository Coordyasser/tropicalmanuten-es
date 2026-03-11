import { useState } from 'react'
import { CalendarDays, LayoutDashboard, LogOut, Plus, Wrench } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useAdminTickets } from '../../hooks/useAdminTickets'
import type { AdminTicket } from '../../hooks/useAdminTickets'
import TicketTable from './TicketTable'
import NovoTicketModal from './NovoTicketModal'
import TicketDetailModal from './TicketDetailModal'
import CalendarioAdmin from './CalendarioAdmin'

type View = 'overview' | 'calendario'

// ─── Sidebar ─────────────────────────────────────────────────

interface SidebarProps {
  view: View
  onSetView: (v: View) => void
  onNovoTicket: () => void
  onSignOut: () => void
  userName: string
}

function Sidebar({ view, onSetView, onNovoTicket, onSignOut, userName }: SidebarProps) {
  const navItem = (v: View, icon: React.ReactNode, label: string) => {
    const active = view === v
    return (
      <button
        onClick={() => onSetView(v)}
        className={[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
          active
            ? 'bg-blue-600/20 text-blue-400'
            : 'text-slate-400 hover:bg-white/5 hover:text-white',
        ].join(' ')}>
        {icon}
        <span>{label}</span>
      </button>
    )
  }

  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-white flex flex-col h-screen sticky top-0">

      {/* Brand */}
      <div className="px-5 pt-7 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Manutencao</p>
            <p className="text-slate-400 text-xs">Painel Admin</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItem('overview',    <LayoutDashboard className="w-4 h-4 shrink-0" />, 'Visao Geral')}
        {navItem('calendario',  <CalendarDays    className="w-4 h-4 shrink-0" />, 'Calendario')}

        <button
          onClick={onNovoTicket}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors text-sm font-medium">
          <Plus className="w-4 h-4 shrink-0" />
          <span>Novo Chamado</span>
        </button>
      </nav>

      {/* User / Logout */}
      <div className="px-3 pb-5 border-t border-white/10 pt-4 space-y-2">
        <div className="px-3 py-2">
          <p className="text-xs text-slate-400 font-medium truncate">{userName}</p>
          <p className="text-xs text-slate-500">Administrador</p>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors text-sm">
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}

// ─── Dashboard ───────────────────────────────────────────────

export default function DashboardAdmin() {
  const { profile, signOut } = useAuth()
  const { tickets, loading, error, refetch } = useAdminTickets()

  const [view,           setView]           = useState<View>('overview')
  const [novoOpen,       setNovoOpen]       = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<AdminTicket | null>(null)

  const abertosCount    = tickets.filter(t => t.status === 'aberto').length
  const pendentesCount  = tickets.filter(t => t.status === 'pendente').length
  const concluidosCount = tickets.filter(t => t.status === 'concluido').length
  const naoConcluidosCount = abertosCount + pendentesCount

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        view={view}
        onSetView={setView}
        onNovoTicket={() => setNovoOpen(true)}
        onSignOut={signOut}
        userName={profile?.name ?? 'Admin'}
      />

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 p-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {view === 'calendario' ? 'Calendario' : 'Visao Geral'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {loading ? 'Carregando...' : `${tickets.length} chamado${tickets.length !== 1 ? 's' : ''} no total`}
              {!loading && naoConcluidosCount > 0 && (
                <span className="ml-2 text-orange-600 font-medium">
                  &bull; {naoConcluidosCount} nao concluido{naoConcluidosCount !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setNovoOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm shadow-blue-500/20 transition-colors text-sm">
            <Plus className="w-4 h-4" />
            Novo Chamado
          </button>
        </div>

        {/* Stats row — only on overview */}
        {view === 'overview' && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total de Chamados', value: tickets.length,   color: 'text-slate-700'   },
              { label: 'Abertos',           value: abertosCount,     color: 'text-slate-600'   },
              { label: 'Pendentes',         value: pendentesCount,   color: 'text-orange-600'  },
              { label: 'Concluidos',        value: concluidosCount,  color: 'text-emerald-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 px-5 py-4 shadow-sm">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.color}`}>{loading ? '—' : stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 min-h-0">
          {view === 'overview' ? (
            <TicketTable
              tickets={tickets}
              loading={loading}
              error={error}
              onVerTicket={setSelectedTicket}
              onRefresh={refetch}
            />
          ) : (
            <CalendarioAdmin
              tickets={tickets}
              loading={loading}
              onVerTicket={setSelectedTicket}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <NovoTicketModal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        onSuccess={refetch}
      />
      <TicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
      />
    </div>
  )
}
