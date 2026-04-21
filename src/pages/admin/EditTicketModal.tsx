import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useProjects } from '../../hooks/useProjects'
import { useTecnicos } from '../../hooks/useTecnicos'
import type { AdminTicket } from '../../hooks/useAdminTickets'
import type { Database, TicketType } from '../../types/database'
import { CATEGORIAS } from '../../lib/categorizeTicket'

interface EditTicketModalProps {
  ticket: AdminTicket | null
  onClose: () => void
  onSuccess: () => void
}

const TICKET_TYPES: { value: TicketType; label: string }[] = [
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'vistoria',   label: 'Vistoria'   },
]

type FormState = {
  projectId: string
  techId: string
  scheduledDate: string
  scheduledTime: string
  unidade: string
  bloco: string
  categoria: string
  description: string
  ticketType: TicketType
}

function ticketToForm(t: AdminTicket): FormState {
  return {
    projectId:     t.project_id     ?? '',
    techId:        t.tech_id        ?? '',
    scheduledDate: t.scheduled_date ?? '',
    scheduledTime: t.scheduled_time ?? '',
    unidade:       t.unidade        ?? '',
    bloco:         t.bloco          ?? '',
    categoria:     t.categoria      ?? '',
    description:   t.description    ?? '',
    ticketType:    t.ticket_type    ?? 'manutencao',
  }
}

export default function EditTicketModal({ ticket, onClose, onSuccess }: EditTicketModalProps) {
  const { projects, loading: projLoading } = useProjects()
  const { tecnicos, loading: techLoading } = useTecnicos()
  const [form, setForm]           = useState<FormState | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    if (ticket) { setForm(ticketToForm(ticket)); setError(null) }
  }, [ticket])

  function set(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => f ? { ...f, [key]: e.target.value } : f)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ticket || !form) return
    const { projectId, techId, scheduledDate, description, unidade } = form
    if (!projectId || !techId || !scheduledDate || !description.trim() || !unidade.trim()) {
      setError('Preencha os campos obrigatorios: Empreendimento, Tecnico, Data, Unidade e Descricao.')
      return
    }
    setSubmitting(true)
    setError(null)
    type TicketUpdate = Database['public']['Tables']['tickets']['Update']
    const payload: TicketUpdate = {
      project_id:     projectId,
      tech_id:        techId,
      scheduled_date: scheduledDate,
      scheduled_time: form.scheduledTime || null,
      unidade:        unidade.trim(),
      bloco:          form.bloco.trim() || null,
      categoria:      form.categoria.trim() || null,
      description:    description.trim(),
      ticket_type:    form.ticketType,
    }
    const { error: updateErr } = await supabase.from('tickets').update(payload).eq('id', ticket.id)
    if (updateErr) { setError(updateErr.message); setSubmitting(false) }
    else { setSubmitting(false); onSuccess(); onClose() }
  }

  if (!ticket || !form) return null

  const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:opacity-50"
  const labelCls = "block text-sm font-medium text-slate-600 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Editar Chamado</h2>
            <p className="text-xs text-slate-400 mt-0.5">ID: {ticket.id.slice(0, 8)}…</p>
          </div>
          <button onClick={onClose} disabled={submitting}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400 disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tipo de Chamado */}
          <div>
            <label className={labelCls}>Tipo de Chamado *</label>
            <div className="grid grid-cols-2 gap-2">
              {TICKET_TYPES.map(tt => (
                <button
                  key={tt.value}
                  type="button"
                  disabled={submitting}
                  onClick={() => setForm(f => f ? { ...f, ticketType: tt.value } : f)}
                  className={[
                    'py-2.5 rounded-xl text-sm font-semibold border-2 transition-all',
                    form.ticketType === tt.value
                      ? tt.value === 'manutencao'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                  ].join(' ')}
                >
                  {tt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Empreendimento */}
          <div>
            <label className={labelCls}>Empreendimento *</label>
            <select value={form.projectId} onChange={set('projectId')}
              disabled={projLoading || submitting} className={inputCls}>
              <option value="">{projLoading ? 'Carregando...' : 'Selecione'}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Unidade + Bloco */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Unidade *</label>
              <input type="text" value={form.unidade} onChange={set('unidade')}
                disabled={submitting} placeholder="Ex: 101" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Bloco</label>
              <input type="text" value={form.bloco} onChange={set('bloco')}
                disabled={submitting} placeholder="Ex: A" className={inputCls} />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className={labelCls}>Categoria</label>
            <select value={form.categoria} onChange={set('categoria')}
              disabled={submitting} className={inputCls}>
              <option value="">Classificando automaticamente...</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Tecnico */}
          <div>
            <label className={labelCls}>Tecnico responsavel *</label>
            <select value={form.techId} onChange={set('techId')}
              disabled={techLoading || submitting} className={inputCls}>
              <option value="">{techLoading ? 'Carregando...' : 'Selecione'}</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Data + Horario */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data agendada *</label>
              <input type="date" value={form.scheduledDate} onChange={set('scheduledDate')}
                disabled={submitting} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Horario</label>
              <input type="time" value={form.scheduledTime} onChange={set('scheduledTime')}
                disabled={submitting} className={inputCls} />
            </div>
          </div>

          {/* Descricao */}
          <div>
            <label className={labelCls}>Descricao *</label>
            <textarea value={form.description} onChange={set('description')}
              disabled={submitting} rows={3} placeholder="Descreva o servico..."
              className={`${inputCls} resize-none`} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : 'Salvar Alteracoes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
