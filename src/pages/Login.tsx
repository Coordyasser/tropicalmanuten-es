import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, Wrench } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, role } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  if (role === 'admin')   { navigate('/admin',   { replace: true }); return null }
  if (role === 'tecnico') { navigate('/tecnico', { replace: true }); return null }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: authError } = await signIn(email, password)
    if (authError) {
      setError('E-mail ou senha invalidos. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Card unificado: logo + formulário */}
        <div className="bg-white overflow-hidden">

          {/* Logo */}
          <div className="flex items-center justify-center pt-6 pb-4 px-8 overflow-hidden">
            <img
              src="/tropical%20vetor.png"
              alt="Tropical Construtora"
              className="w-4/5"
            />
          </div>

          {/* Título */}
          <div className="flex flex-col items-center gap-1 px-8 pt-6 pb-8 text-center">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-brand-red" />
              <h1 className="text-lg font-semibold text-slate-800">Portal de Manutenções</h1>
            </div>
            <p className="text-sm text-slate-500">Faça login para gerenciar os chamados e ordens de serviço</p>
          </div>

          {/* Formulário */}
          <div className="px-8 pb-8">

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 mb-6 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={loading}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 px-4 py-3 text-sm outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="..."
                  disabled={loading}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 px-4 py-3 text-sm outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full flex items-center justify-center gap-2 bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors shadow-lg mt-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</>
                ) : (
                  'Entrar'
                )}
              </button>

            </form>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Acesso restrito a usuarios cadastrados
        </p>
      </div>
    </div>
  )
}
