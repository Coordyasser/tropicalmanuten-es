import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import AuthGuard from './components/AuthGuard'
import Login from './pages/Login'
import DashboardAdmin from './pages/admin/DashboardAdmin'
import DashboardTecnico from './pages/tecnico/DashboardTecnico'
import BaixaTicket from './pages/tecnico/BaixaTicket'

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-200">404</h1>
        <p className="text-slate-500 mt-2">Pagina nao encontrada</p>
        <a href="/" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
          Voltar ao inicio
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Publica */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />

        {/* Admin */}
        <Route
          path="/admin/*"
          element={
            <AuthGuard requiredRole="admin">
              <DashboardAdmin />
            </AuthGuard>
          }
        />

        {/* Tecnico */}
        <Route
          path="/tecnico"
          element={
            <AuthGuard requiredRole="tecnico">
              <DashboardTecnico />
            </AuthGuard>
          }
        />
        <Route
          path="/tecnico/baixa"
          element={
            <AuthGuard requiredRole="tecnico">
              <BaixaTicket />
            </AuthGuard>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}
