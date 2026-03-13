import { useState } from 'react'
import { CalendarDays, LayoutDashboard, LogOut, Menu, Plus, X } from 'lucide-react'
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
  onClose?: () => void
}

function Sidebar({ view, onSetView, onNovoTicket, onSignOut, userName, onClose }: SidebarProps) {
  const navItem = (v: View, icon: React.ReactNode, label: string) => {
    const active = view === v
    return (
      <button
        onClick={() => { onSetView(v); onClose?.() }}
        className={[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
          active
            ? 'bg-brand-red text-white'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
        ].join(' ')}>
        {icon}
        <span>{label}</span>
      </button>
    )
  }

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col h-full">

      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-slate-100 flex items-center justify-between">
        <img
          src="/logo%20tropical.jpg.jpeg"
          alt="Tropical Construtora"
          className="h-10 w-10 object-cover rounded-xl"
        />
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 md:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItem('overview',   <LayoutDashboard className="w-4 h-4 shrink-0" />, 'Visao Geral')}
        {navItem('calendario', <CalendarDays    className="w-4 h-4 shrink-0" />, 'Calendario')}

        <button
          onClick={() => { onNovoTicket(); onClose?.() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4 shrink-0" />
          <span>Novo Chamado</span>
        </button>
      </nav>

      {/* User / Logout */}
      <div className="px-3 pb-5 border-t border-slate-100 pt-4 space-y-2">
        <div className="px-3 py-2">
          <p className="text-xs text-slate-700 font-medium truncate">{userName}</p>
          <p className="text-xs text-slate-400">Administrador</p>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-brand-red transition-colors text-sm">
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
  const [sidebarOpen,    setSidebarOpen]    = useState(false)

  const abertosCount       = tickets.filter(t => t.status === 'aberto').length
  const pendentesCount     = tickets.filter(t => t.status === 'pendente').length
  const concluidosCount    = tickets.filter(t => t.status === 'concluido').length
  const naoConcluidosCount = abertosCount + pendentesCount

  return (
    <div className="flex min-h-screen bg-slate-100">

      {/* ── Desktop sidebar (always visible on md+) ── */}
      <div className="hidden md:flex md:h-screen md:sticky md:top-0">
        <Sidebar
          view={view}
          onSetView={setView}
          onNovoTicket={() => setNovoOpen(true)}
          onSignOut={signOut}
          userName={profile?.name ?? 'Admin'}
        />
      </div>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute left-0 top-0 h-full"
            onClick={e => e.stopPropagation()}>
            <Sidebar
              view={view}
              onSetView={setView}
              onNovoTicket={() => setNovoOpen(true)}
              onSignOut={signOut}
              userName={profile?.name ?? 'Admin'}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 p-4 md:p-8">

        {/* ── Mobile top bar ── */}
        <div className="flex items-center justify-between mb-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-white transition-colors text-slate-600">
            <Menu className="w-5 h-5" />
          </button>
          <img
            src="/logo%20tropical.jpg.jpeg"
            alt="Tropical Construtora"
            className="h-8 w-8 object-cover rounded-xl"
          />
          <button
            onClick={() => setNovoOpen(true)}
            className="flex items-center gap-1.5 bg-brand-red hover:bg-brand-red-dark text-white font-semibold px-3 py-2 rounded-xl text-sm transition-colors">
            <Plus className="w-4 h-4" />
            Novo
          </button>
        </div>

        {/* Header (desktop only full version) */}
        <div className="hidden md:flex items-start justify-between mb-6">
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
            className="flex items-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm shadow-brand-red/20 transition-colors text-sm">
            <Plus className="w-4 h-4" />
            Novo Chamado
          </button>
        </div>

        {/* Mobile page title */}
        <div className="md:hidden mb-4">
          <h1 className="text-xl font-bold text-slate-800">
            {view === 'calendario' ? 'Calendario' : 'Visao Geral'}
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {loading ? 'Carregando...' : `${tickets.length} chamados`}
            {!loading && naoConcluidosCount > 0 && (
              <span className="ml-2 text-orange-600 font-medium">
                &bull; {naoConcluidosCount} nao concluidos
              </span>
            )}
          </p>
        </div>

        {/* Stats row — only on overview */}
        {view === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            {[
              { label: 'Total de Chamados', value: tickets.length,  color: 'text-slate-700'   },
              { label: 'Abertos',           value: abertosCount,    color: 'text-slate-600'   },
              { label: 'Pendentes',         value: pendentesCount,  color: 'text-orange-600'  },
              { label: 'Concluidos',        value: concluidosCount, color: 'text-emerald-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 px-4 py-3 md:px-5 md:py-4 shadow-sm">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1 leading-tight">{stat.label}</p>
                <p className={`text-2xl md:text-3xl font-bold ${stat.color}`}>{loading ? '—' : stat.value}</p>
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
