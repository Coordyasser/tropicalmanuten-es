import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, Camera, CheckCircle2, Clock,
  Loader2, Lock, MapPin, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import SignatureCanvas from '../../components/SignatureCanvas'
import type { SignatureCanvasHandle } from '../../components/SignatureCanvas'
import type { TicketWithRelations } from '../../hooks/useTickets'
import type { Database, TicketStatus } from '../../types/database'

// ── Types ─────────────────────────────────────────────────────────────────────
interface LocationState { tickets: TicketWithRelations[] }
interface TicketForm {
  status: TicketStatus
  observacao: string
  changed: boolean
  photoFile: File | null
  photoPreview: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d: string): string {
  const [, m, day] = d.split('-')
  return `${day}/${m}/${d.slice(0, 4)}`
}
function todayBR(): string { return new Date().toLocaleDateString('pt-BR') }
function buildReport(newObs: string, old: string | null): string {
  const entry = `[${todayBR()}] ${newObs.trim()}`
  return old ? `${entry}\n\n${old}` : entry
}

// ── StatusSelector ────────────────────────────────────────────────────────────
const STATUS_OPTS: { v: TicketStatus; label: string; active: string; dot: string }[] = [
  { v: 'pendente',  label: 'Pendente',  active: 'border-orange-400 bg-orange-50 text-orange-700',    dot: 'bg-orange-400'  },
  { v: 'concluido', label: 'Concluido', active: 'border-emerald-500 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
]
function StatusSelector({ value, onChange }: { value: TicketStatus; onChange: (s: TicketStatus) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {STATUS_OPTS.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={['flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all',
            value === o.v ? o.active : 'border-slate-200 bg-white text-slate-400'].join(' ')}>
          <span className={`w-2 h-2 rounded-full ${value === o.v ? o.dot : 'bg-slate-200'}`} />
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── TicketItem ────────────────────────────────────────────────────────────────
interface TicketItemProps {
  ticket: TicketWithRelations
  form: TicketForm
  sigRef: React.Ref<SignatureCanvasHandle>
  onChange: (patch: Partial<TicketForm>) => void
}

function TicketItem({ ticket, form, sigRef, onChange }: TicketItemProps) {
  const photoInputRef = useRef<HTMLInputElement>(null)
  const isConcluido   = ticket.status === 'concluido'   // original status from DB
  const isPendente    = ticket.status === 'pendente'     // original status from DB

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onChange({ photoFile: file, photoPreview: URL.createObjectURL(file), changed: true })
  }
  function removePhoto() {
    onChange({ photoFile: null, photoPreview: null })
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  // ── Read-only view for already-concluded tickets ───────────────────────────
  if (isConcluido) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden opacity-75">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-50 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Descricao</p>
            <p className="text-slate-700 text-sm leading-relaxed">{ticket.description}</p>
            {ticket.categoria && (
              <span className="inline-block mt-1.5 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                {ticket.categoria}
              </span>
            )}
          </div>
          {/* Lock badge */}
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
            <Lock className="w-3 h-3" />
            Concluido
          </span>
        </div>
        {/* Existing report */}
        {ticket.report && (
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Relatorio</p>
            <pre className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-3">
              {ticket.report}
            </pre>
          </div>
        )}
      </div>
    )
  }

  // ── Editable view (aberto or pendente) ────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

      {/* Description */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-50">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Descricao</p>
        <p className="text-slate-700 text-sm leading-relaxed">{ticket.description}</p>
        {ticket.categoria && (
          <span className="inline-block mt-1.5 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
            {ticket.categoria}
          </span>
        )}
      </div>

      {/* Historico anterior — para tickets pendentes, sempre visivel */}
      {isPendente && ticket.report && (
        <div className="px-4 pt-3">
          <p className="text-xs font-semibold text-slate-500 mb-1.5">Historico anterior</p>
          <pre className="text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-3">
            {ticket.report}
          </pre>
        </div>
      )}

      {/* Status */}
      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-600 mb-2">Status</p>
        <StatusSelector value={form.status} onChange={v => onChange({ status: v, changed: true })} />
      </div>

      {/* Observacao — nova entrada sempre vazia */}
      <div className="px-4 pb-3">
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">
          Observacao
          {form.status === 'pendente' && (
            <span className="ml-1 font-normal text-slate-400">(sera adicionada ao historico)</span>
          )}
        </label>
        <textarea rows={3} value={form.observacao}
          onChange={e => onChange({ observacao: e.target.value, changed: true })}
          placeholder={form.status === 'pendente' ? 'Ex: Aguardando material...' : 'O que foi realizado...'}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 resize-none transition" />
      </div>

      {/* Foto + Assinatura — apenas quando Concluido (selecionado) */}
      {form.status === 'concluido' && (
        <>
          {/* Foto */}
          <div className="px-4 pb-3">
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Foto <span className="font-normal text-slate-400">(opcional)</span>
            </p>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment"
              className="hidden" onChange={handlePhotoChange} />
            {form.photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                <img src={form.photoPreview} alt="Foto" className="w-full h-40 object-cover" />
                <button type="button" onClick={removePhoto}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-slate-300 rounded-xl bg-white flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors active:scale-[0.98]">
                <Camera className="w-6 h-6" />
                <span className="text-xs font-medium">Tirar foto</span>
              </button>
            )}
          </div>

          {/* Assinatura */}
          <div className="px-4 pb-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Assinatura do cliente <span className="font-normal text-slate-400">(opcional)</span>
            </p>
            <SignatureCanvas ref={sigRef} />
          </div>
        </>
      )}
    </div>
  )
}

// ── BaixaTicket ───────────────────────────────────────────────────────────────
export default function BaixaTicket() {
  const navigate = useNavigate()
  const location = useLocation()
  const state    = location.state as LocationState | null

  const sigRefs = useRef<Map<string, SignatureCanvasHandle | null>>(new Map())

  const [forms, setForms] = useState<Map<string, TicketForm>>(() => {
    const m = new Map<string, TicketForm>()
    for (const t of state?.tickets ?? []) {
      // Already-concluded tickets get their original status (read-only view will render instead)
      // Aberto tickets default to 'concluido' so the tech must consciously switch to 'pendente'
      const initial: TicketStatus = t.status === 'aberto' ? 'concluido' : t.status
      m.set(t.id, { status: initial, observacao: '', changed: false, photoFile: null, photoPreview: null })
    }
    return m
  })
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!state?.tickets?.length) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-slate-600 text-sm">Nenhum chamado encontrado.</p>
        <button onClick={() => navigate('/tecnico')} className="text-blue-600 text-sm font-medium underline">Voltar</button>
      </div>
    )
  }

  const tickets        = state.tickets
  const first          = tickets[0]
  const locationName   = first.project?.name ?? '—'
  const locationDetail = [
    first.unidade ? `Unid. ${first.unidade}` : null,
    first.bloco   ? `Bl. ${first.bloco}`     : null,
  ].filter(Boolean).join(' / ')

  // Only show Finalizar when there are editable (non-concluded) tickets
  const hasEditable = tickets.some(t => t.status !== 'concluido')

  function updateForm(id: string, patch: Partial<TicketForm>) {
    setForms(prev => { const m = new Map(prev); m.set(id, { ...prev.get(id)!, ...patch }); return m })
  }

  async function handleFinalizar() {
    setSubmitting(true)
    setSubmitError(null)
    const changed = tickets.filter(t => t.status !== 'concluido' && forms.get(t.id)?.changed)

    for (const ticket of changed) {
      const form      = forms.get(ticket.id)!
      const sigHandle = sigRefs.current.get(ticket.id) ?? null

      // ── Report ──────────────────────────────────────────────────────────────
      let report: string | null = ticket.report
      if (form.observacao.trim()) {
        report = form.status === 'pendente'
          ? buildReport(form.observacao, ticket.report)
          : form.observacao.trim()
      }

      // ── Photo upload (only on concluido) ────────────────────────────────────
      let photoUrl: string | null = ticket.photo_url
      if (form.status === 'concluido' && form.photoFile) {
        const ext  = (form.photoFile.name.split('.').pop() ?? 'jpg').split('?')[0]
        const path = `tickets/${ticket.id}/photo.${ext}`
        const { data: upd, error: upe } = await supabase.storage
          .from('photos')
          .upload(path, form.photoFile, { upsert: true, contentType: form.photoFile.type || 'image/jpeg' })
        if (upe) { setSubmitError(`Erro ao enviar foto: ${upe.message}`); setSubmitting(false); return }
        if (upd)  { photoUrl = supabase.storage.from('photos').getPublicUrl(upd.path).data.publicUrl }
      }

      // ── Signature upload (only on concluido) ────────────────────────────────
      let signatureUrl: string | null = ticket.signature_url
      if (form.status === 'concluido' && sigHandle && !sigHandle.isEmpty()) {
        const dataUrl = sigHandle.getDataURL()
        const blob    = await (await fetch(dataUrl)).blob()
        const { data: sigd, error: sige } = await supabase.storage
          .from('photos')
          .upload(`tickets/${ticket.id}/signature.png`, blob, { upsert: true, contentType: 'image/png' })
        if (sige) { setSubmitError(`Erro ao enviar assinatura: ${sige.message}`); setSubmitting(false); return }
        if (sigd)  { signatureUrl = supabase.storage.from('photos').getPublicUrl(sigd.path).data.publicUrl }
      }

      // ── Save ────────────────────────────────────────────────────────────────
      const { error } = await supabase
        .from('tickets')
        .update({
          status: form.status,
          report,
          photo_url:     form.status === 'concluido' ? photoUrl     : ticket.photo_url,
          signature_url: form.status === 'concluido' ? signatureUrl : ticket.signature_url,
        } satisfies Database['public']['Tables']['tickets']['Update'])
        .eq('id', ticket.id)
      if (error) { setSubmitError(error.message); setSubmitting(false); return }
    }

    // ── Redirect back to dashboard on success ───────────────────────────────
    navigate('/tecnico', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="sticky top-0 z-10 bg-blue-700 text-white px-4 pt-10 pb-4 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/tecnico')}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="text-blue-200 text-xs">Baixa de Chamados</p>
            <h1 className="font-bold text-base truncate">{locationName}</h1>
            {locationDetail && <p className="text-blue-200 text-xs truncate">{locationDetail}</p>}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
          <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-slate-700 font-semibold text-sm truncate">{locationName}</p>
            {locationDetail && <p className="text-slate-400 text-xs">{locationDetail}</p>}
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-xs shrink-0">
            <Clock className="w-3.5 h-3.5" />{formatDate(first.scheduled_date)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
            {tickets.length} chamado{tickets.length > 1 ? 's' : ''}
          </span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {tickets.map(ticket => (
          <TicketItem
            key={ticket.id}
            ticket={ticket}
            form={forms.get(ticket.id)!}
            sigRef={el => { sigRefs.current.set(ticket.id, el) }}
            onChange={patch => updateForm(ticket.id, patch)}
          />
        ))}

        {submitError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{submitError}</span>
          </div>
        )}
      </main>

      {/* Finalizar — hidden when all tickets are already concluded */}
      {hasEditable && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-slate-200 p-4">
          <button type="button" disabled={submitting} onClick={handleFinalizar}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl py-4 shadow-lg shadow-emerald-500/30 transition-all">
            {submitting
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Salvando...</>
              : <><CheckCircle2 className="w-5 h-5" /> FINALIZAR</>}
          </button>
        </div>
      )}
    </div>
  )
}
