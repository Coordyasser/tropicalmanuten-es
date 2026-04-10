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

import type { AdminTicket } from '../../hooks/useAdminTickets'

interface NovoTicketModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: AdminTicket | null
}

const COMPLAINT_CHANNELS = ['WhatsApp', 'Telefone', 'E-mail', 'Presencial'] as const

const EMPTY = {
  projectId: '', techId: '', scheduledDate: '', scheduledTime: '',
  unidade: '', bloco: '', description: '',
  clientName: '', clientPhone: '', complaintChannel: '', initialProvision: '',
  osNumber: '',
}

export default function NovoTicketModal({ open, onClose, onSuccess, initialData }: NovoTicketModalProps) {
  const { projects, loading: projLoading } = useProjects()
  const { tecnicos, loading: techLoading } = useTecnicos()
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setForm(EMPTY)
      setError(null)
    } else if (initialData) {
      setForm({
        projectId:        initialData.project_id,
        techId:           initialData.tech_id,
        scheduledDate:    '',
        scheduledTime:    '',
        unidade:          initialData.unidade          ?? '',
        bloco:            initialData.bloco            ?? '',
        description:      initialData.description,
        clientName:       initialData.client_name      ?? '',
        clientPhone:      initialData.client_phone     ?? '',
        complaintChannel: initialData.complaint_channel ?? '',
        initialProvision: initialData.initial_provision ?? '',
        osNumber:         '',
      })
      setError(null)
    }
  }, [open])

  function set(key: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const { projectId, techId, scheduledDate, description, unidade, osNumber } = form
    if (!projectId || !techId || !scheduledDate || !description.trim() || !unidade.trim()) {
      setError('Preencha os campos obrigatorios: Empreendimento, Tecnico, Data, Unidade e Descricao.')
      return
    }
    const osNum = parseInt(osNumber, 10)
    if (!osNumber || isNaN(osNum) || osNum < 1) {
      setError('Informe um Nº da O.S. válido.')
      return
    }
    setSubmitting(true)
    setError(null)

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
      os_number: osNum,
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('tickets').insert(payload).select('id').single()
    if (insertErr) { setError(insertErr.message); setSubmitting(false); return }

    if (inserted?.id) {
      const selectedProject = projects.find(p => p.id === projectId)
      const osData: OsData = {
        ticketId: inserted.id,
        projectName: selectedProject?.name ?? '',
        unidade: unidade.trim(),
        bloco: form.bloco.trim() || null,
        clientName: form.clientName.trim() || null,
        clientPhone: form.clientPhone.trim() || null,
        osNumber: osNum,
        complaintChannel: form.complaintChannel || null,
        scheduledDate: scheduledDate,
        scheduledTime: form.scheduledTime || null,
        description: description.trim(),
        initialProvision: form.initialProvision.trim() || null,
      }

      // allSettled garante que categorize sempre roda, mesmo se o PDF falhar
      const [pdfResult] = await Promise.allSettled([
        generateAndUploadOs(osData),
        categorizeTicket(description.trim()).then(categoria =>
          supabase.from('tickets').update({ categoria }).eq('id', inserted.id)
        ),
      ])

      if (pdfResult.status === 'fulfilled') {
        // Trava de segurança: só finaliza após o update com a URL ser confirmado
        await supabase.from('tickets').update({ os_pdf_url: pdfResult.value }).eq('id', inserted.id)
        setSubmitting(false); onSuccess(); onClose()
      } else {
        // PDF falhou: avisa o usuário mas não perde o chamado criado
        const reason = pdfResult.reason instanceof Error ? pdfResult.reason.message : 'Erro desconhecido'
        setSubmitting(false)
        onSuccess() // atualiza a lista (ticket foi salvo)
        setError(`Chamado criado, mas o PDF da O.S. não foi gerado: ${reason}. Acesse os detalhes do chamado para gerar novamente.`)
        return // mantém o modal aberto para o usuário ver o aviso
      }
    } else {
      setSubmitting(false); onSuccess(); onClose()
    }
  }

  if (!open) return null

  const inputCls = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:opacity-50"
  const labelCls = "block text-sm font-medium text-slate-600 mb-1"

  function handleKeyDown(e: React.KeyboardEvent) {
    // Bloqueia ESC para não fechar o modal acidentalmente
    if (e.key === 'Escape') { e.stopPropagation(); return }
    // Bloqueia Enter fora de textarea para não disparar submit
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-bold text-slate-800 text-lg">Novo Chamado</h2>
          <button type="button" onClick={onClose} disabled={submitting}
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
                disabled={submitting} className={inputCls} />
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

          {/* Nº da O.S. */}
          <div>
            <label className={labelCls}>Nº da O.S. *</label>
            <input type="number" min={1} value={form.osNumber} onChange={set('osNumber')} disabled={submitting}
              placeholder="Ex: 1, 42" className={inputCls} />
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
