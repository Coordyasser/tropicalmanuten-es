import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Role } from '../types/database'

// ─── Types ───────────────────────────────────────────────────

interface Profile {
  id: string
  name: string
  role: Role
  phone: string | null
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: Role | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

// ─── Context ─────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    role: null,
    loading: true,
  })

  /** Busca o perfil na tabela `profiles` e atualiza o estado. */
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, phone')
      .eq('id', userId)
      .single()

    if (error || !data) return null
    return data as Profile
  }, [])

  /** Sincroniza a sessão + perfil com o estado local. */
  const syncSession = useCallback(
    async (session: Session | null) => {
      if (!session) {
        setState({ session: null, user: null, profile: null, role: null, loading: false })
        return
      }

      const profile = await fetchProfile(session.user.id)
      setState({
        session,
        user: session.user,
        profile,
        role: profile?.role ?? null,
        loading: false,
      })
    },
    [fetchProfile],
  )

  // Inicializa sessão ao montar e escuta mudanças de auth
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) syncSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) syncSession(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [syncSession])

  // ── Actions ──────────────────────────────────────────────

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      return { error: null }
    },
    [],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
