import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useProjects } from '../../hooks/useProjects'
import { useTecnicos } from '../../hooks/useTecnicos'
import type { Database } from '../../types/database'
import { categorizeTicket } from '../../lib/categorizeTicket'
import { generateAndUploadOs } from '../../lib/generateOsPdf'
import type { OsData } from '../../lib/generateOsPdf'

interface NovoTicketModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const COMPLAINT_CHANNELS = ['WhatsApp', 'Telefone', 'E-mail', 'Presencial'] as const

const EMPTY = {
  projectId: '', techId: '', scheduledDate: '', scheduledTime: '',
  unidade: '', bloco: '', description: '',
  clientName: '', clientPhone: '', complaintChannel: '', initialProvision: '',
}

async function calcOsNumber(projectId: string, unidade: string, bloco: string): Promise<number> {
  const { data } = await supabase
    .from('tickets')
    .select('os_number')
    .eq('project_id', projectId)
    .eq('unidade', unidade.trim())
    .eq('bloco', bloco.trim() || '')
    .neq('status', 'concluido')

  if (!data || data.length === 0) return 1

  const max = Math.max(...data.map(t => t.os_number ?? 0))
  return max + 1
}

export default function NovoTicketModal({ open, onClose, onSuccess }: NovoTicketModalProps) {
  const { projects, loading: projLoading } = useProjects()
  const { tecnicos, loading: techLoading } = useTecnicos()
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (!open) { setForm(EMPTY); setError(null) } }, [open])

  function set(key: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const { projectId, techId, scheduledDate, description, unidade } = form
    if (!projectId || !techId || !scheduledDate || !description.trim() || !unidade.trim()) {
      setError('Preencha os campos obrigatorios: Empreendimento, Tecnico, Data, Unidade e Descricao.')
      return
    }
    setSubmitting(true)
    setError(null)

    const osNumber = await calcOsNumber(projectId, unidade, form.bloco)

    type TicketInsert = Database['public']['Tables']['tickets']['Insert']
    const payload: TicketInsert = {
      project_id: projectId,
      tech_id: techId,
      scheduled_date: scheduledDate,
      scheduled_time: form.scheduledTime || null,
      unidade: unidade.trim(),
      bloco: form.bloco.trim() || null,
      description: description.trim(),
      status: 'aberto',
      client_name: form.clientName.trim() || null,
      client_phone: form.clientPhone.trim() || null,
      complaint_channel: form.complaintChannel || null,
      initial_provision: form.initialProvision.trim() || null,
      os_number: osNumber,
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('tickets').insert(payload).select('id').single()
    if (insertErr) { setError(insertErr.message); setSubmitting(false); return }

    // Background tasks: categorize + generate OS PDF — do not block the UI
    if (inserted?.id) {
      const selectedProject = projects.find(p => p.id === projectId)
      const osData: OsData = {
        ticketId: inserted.id,
        projectName: selectedProject?.name ?? '',
        unidade: unidade.trim(),
        bloco: form.bloco.trim() || null,
        clientName: form.clientName.trim() || null,
        clientPhone: form.clientPhone.trim() || null,
        osNumber,
        complaintChannel: form.complaintChannel || null,
        scheduledDate: scheduledDate,
        scheduledTime: form.scheduledTime || null,
        description: description.trim(),
        initialProvision: form.initialProvision.trim() || null,
      }
      generateAndUploadOs(osData).then(url => {
        if (url) supabase.from('tickets').update({ os_pdf_url: url }).eq('id', inserted.id).then()
      })
      categorizeTicket(description.trim()).then(categoria =>
        supabase.from('tickets').update({ categoria }).eq('id', inserted.id).then()
      )
    }

    setSubmitting(false); onSuccess(); onClose()
  }

  if (!open) return null

  const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:opacity-50"
  const labelCls = "block text-sm font-medium text-slate-600 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-bold text-slate-800 text-lg">Novo Chamado</h2>
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

          {/* Empreendimento */}
          <div>
            <label className={labelCls}>Empreendimento *</label>
            <select value={form.projectId} onChange={set('projectId')} disabled={projLoading || submitting} className={inputCls}>
              <option value="">{projLoading ? 'Carregando...' : 'Selecione o empreendimento'}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Unidade + Bloco */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Unidade *</label>
              <input type="text" value={form.unidade} onChange={set('unidade')} disabled={submitting}
                placeholder="Ex: 101, Apto 5" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Bloco</label>
              <input type="text" value={form.bloco} onChange={set('bloco')} disabled={submitting}
                placeholder="Ex: A, Torre 1" className={inputCls} />
            </div>
          </div>

          {/* Técnico */}
          <div>
            <label className={labelCls}>Tecnico responsavel *</label>
            <select value={form.techId} onChange={set('techId')} disabled={techLoading || submitting} className={inputCls}>
              <option value="">{techLoading ? 'Carregando...' : 'Selecione o tecnico'}</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Data + Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data agendada *</label>
              <input type="date" value={form.scheduledDate} onChange={set('scheduledDate')}
                disabled={submitting} min={new Date().toISOString().split('T')[0]} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Horario</label>
              <input type="time" value={form.scheduledTime} onChange={set('scheduledTime')}
                disabled={submitting} className={inputCls} />
            </div>
          </div>

          {/* Nome + Contato do cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nome do cliente</label>
              <input type="text" value={form.clientName} onChange={set('clientName')} disabled={submitting}
                placeholder="Ex: João Silva" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contato do cliente</label>
              <input type="text" value={form.clientPhone} onChange={set('clientPhone')} disabled={submitting}
                placeholder="Ex: (11) 99999-9999" className={inputCls} />
            </div>
          </div>

          {/* Via da Reclamação */}
          <div>
            <label className={labelCls}>Via da reclamação</label>
            <select value={form.complaintChannel} onChange={set('complaintChannel')} disabled={submitting} className={inputCls}>
              <option value="">Selecione o canal</option>
              {COMPLAINT_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className={labelCls}>Descricao *</label>
            <textarea value={form.description} onChange={set('description')} disabled={submitting}
              rows={3} placeholder="Descreva o servico a ser realizado..."
              className={`${inputCls} resize-none`} />
          </div>

          {/* Providência Inicial */}
          <div>
            <label className={labelCls}>Providência inicial</label>
            <textarea value={form.initialProvision} onChange={set('initialProvision')} disabled={submitting}
              rows={2} placeholder="Ex: Enviado técnico para vistoria..."
              className={`${inputCls} resize-none`} />
          </div>

          {/* Ações */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : 'Criar Chamado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
