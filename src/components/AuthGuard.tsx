import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types/database'

interface AuthGuardProps {
  /** Role que tem permissao de acessar esta rota. */
  requiredRole: Role
  children: ReactNode
}

/**
 * Protege rotas por autenticacao e por role.
 *
 * Comportamentos:
 * - Loading -> exibe spinner centralizado
 * - Nao autenticado -> redireciona para /login
 * - Role errado -> redireciona para a rota correta do usuario
 * - Role correto -> renderiza os filhos normalmente
 */
export default function AuthGuard({ requiredRole, children }: AuthGuardProps) {
  const { loading, session, role } = useAuth()
  const location = useLocation()

  // 1. Aguarda verificacao da sessao
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-sm">Verificando sessao...</span>
        </div>
      </div>
    )
  }

  // 2. Nao autenticado -> /login
  if (!session || !role) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 3. Role incorreto -> rota correta do usuario
  if (role !== requiredRole) {
    const redirect = role === 'admin' ? '/admin' : '/tecnico'
    return <Navigate to={redirect} replace />
  }

  // 4. Tudo certo -> renderiza a pagina
  return <>{children}</>
}
