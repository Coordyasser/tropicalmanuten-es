import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  Camera, CheckCircle2, Clock, FileDown, Image,
  Loader2, MapPin, Timer, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import SignatureCanvas from '../../components/SignatureCanvas'
import type { SignatureCanvasHandle } from '../../components/SignatureCanvas'
import { AudioPlayer, AudioRecorder } from '../tecnico/BaixaTicket'
import type { AdminTicket } from '../../hooks/useAdminTickets'
import type { Database, TicketStatus } from '../../types/database'

// ── Types ─────────────────────────────────────────────────────────────────────
interface TicketForm {
  status: TicketStatus
  observacao: string
  photoFile: File | null
  photoPreview: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function todayBR(): string { return new Date().toLocaleDateString('pt-BR') }
function buildReport(newObs: string, old: string | null): string {
  const entry = `[${todayBR()}] ${newObs.trim()}`
  return old ? `${entry}\n\n${old}` : entry
}
function parseScheduledAt(date: string, time: string | null): Date {
  const hhmm = time ? time.slice(0, 5) : '00:00'
  const dt = new Date(`${date}T${hhmm}:00`)
  return isNaN(dt.getTime()) ? new Date(`${date}T00:00:00`) : dt
}
function formatDuration(startAt: Date, endAt: Date): string {
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) return '—'
  const totalMins = Math.max(0, Math.floor((endAt.getTime() - startAt.getTime()) / 60_000))
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
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

// ── Main component ────────────────────────────────────────────────────────────
interface AtenderTicketModalProps {
  ticket: AdminTicket
  onClose: () => void
  onSuccess: () => void
}

export default function AtenderTicketModal({ ticket, onClose, onSuccess }: AtenderTicketModalProps) {
  const sigRef = useRef<SignatureCanvasHandle | null>(null)
  const cameraInputRef  = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const initialStatus: TicketStatus =
    ticket.status === 'aberto' ? 'concluido' : ticket.status

  const [form, setForm] = useState<TicketForm>({
    status:       initialStatus,
    observacao:   '',
    photoFile:    null,
    photoPreview: null,
  })
  const [localAudioUrl,    setLocalAudioUrl]    = useState(ticket.audio_url ?? null)
  const [localResAudioUrl, setLocalResAudioUrl] = useState(ticket.resolution_audio_url ?? null)
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isConcluido  = ticket.status === 'concluido'
  const isPendente   = ticket.status === 'pendente'
  const locationName = ticket.project?.name ?? '—'
  const locationDetail = [
    ticket.unidade ? `Unid. ${ticket.unidade}` : null,
    ticket.bloco   ? `Bl. ${ticket.bloco}`     : null,
  ].filter(Boolean).join(' / ')

  function patch(p: Partial<TicketForm>) { setForm(prev => ({ ...prev, ...p })) }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    patch({ photoFile: file, photoPreview: URL.createObjectURL(file) })
  }
  function removePhoto() {
    patch({ photoFile: null, photoPreview: null })
    if (cameraInputRef.current)  cameraInputRef.current.value  = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  async function handleSave() {
    setSubmitting(true)
    setSubmitError(null)

    const isConcluding = form.status === 'concluido'
    const concludedAt  = new Date()
    const startAt      = parseScheduledAt(ticket.scheduled_date, ticket.scheduled_time)

    // ── Photo upload ──────────────────────────────────────────────────────────
    let photoUrl: string | null = ticket.photo_url
    if (isConcluding && form.photoFile) {
      const ext  = (form.photoFile.name.split('.').pop() ?? 'jpg').split('?')[0]
      const path = `tickets/${ticket.id}/photo.${ext}`
      const { data: upd, error: upe } = await supabase.storage
        .from('photos')
        .upload(path, form.photoFile, { upsert: true, contentType: form.photoFile.type || 'image/jpeg' })
      if (upe) { setSubmitError(`Erro ao enviar foto: ${upe.message}`); setSubmitting(false); return }
      if (upd) photoUrl = supabase.storage.from('photos').getPublicUrl(upd.path).data.publicUrl
    }

    // ── Signature upload ──────────────────────────────────────────────────────
    let signatureUrl: string | null = ticket.signature_url
    if (isConcluding && sigRef.current && !sigRef.current.isEmpty()) {
      const dataUrl = sigRef.current.getDataURL()
      const blob    = await (await fetch(dataUrl)).blob()
      const { data: sigd, error: sige } = await supabase.storage
        .from('photos')
        .upload(`tickets/${ticket.id}/signature.png`, blob, { upsert: true, contentType: 'image/png' })
      if (sige) { setSubmitError(`Erro ao enviar assinatura: ${sige.message}`); setSubmitting(false); return }
      if (sigd) signatureUrl = supabase.storage.from('photos').getPublicUrl(sigd.path).data.publicUrl
    }

    // ── Report / resolution notes ─────────────────────────────────────────────
    let report: string | null = ticket.report
    let resolutionNotes: string | null = ticket.resolution_notes ?? null
    if (form.observacao.trim()) {
      if (isConcluding) resolutionNotes = form.observacao.trim()
      else report = buildReport(form.observacao, ticket.report)
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    const updatePayload: Database['public']['Tables']['tickets']['Update'] = {
      status:        form.status,
      report,
      completed_at:  isConcluding ? concludedAt.toISOString() : null,
      duration:      isConcluding ? formatDuration(startAt, concludedAt) : null,
      photo_url:     isConcluding ? photoUrl     : ticket.photo_url,
      signature_url: isConcluding ? signatureUrl : ticket.signature_url,
    }
    if (isConcluding) updatePayload.resolution_notes = resolutionNotes

    const { error: err } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticket.id)

    if (err) { setSubmitError(err.message); setSubmitting(false); return }

    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-100 w-full sm:max-w-lg sm:rounded-2xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="bg-brand-red text-white px-4 pt-5 pb-4 shrink-0 flex items-center gap-3">
          <MapPin className="w-4 h-4 shrink-0 text-white/70" />
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-xs">Atender como Técnico</p>
            <h2 className="font-bold text-base truncate">{locationName}</h2>
            {locationDetail && <p className="text-white/60 text-xs">{locationDetail}</p>}
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Date info */}
          <div className="bg-white rounded-2xl px-4 py-3 border border-slate-100 shadow-sm flex items-center gap-3">
            <Clock className="w-4 h-4 text-brand-red shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-slate-700 font-semibold text-sm truncate">{locationName}</p>
              {locationDetail && <p className="text-slate-400 text-xs">{locationDetail}</p>}
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-xs shrink-0">
              <Timer className="w-3.5 h-3.5" />{formatDate(ticket.scheduled_date)}
            </div>
          </div>

          {/* Card */}
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

            {/* Timer */}
            <div className="px-4 pt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3 h-3" />{formatDate(ticket.scheduled_date)}
              {ticket.scheduled_time && ` às ${ticket.scheduled_time}`}
            </div>

            {/* If already concluded — read-only view */}
            {isConcluido ? (
              <div className="px-4 py-3 space-y-3">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                  Concluído
                </span>
                {(ticket.report || ticket.resolution_notes) && (
                  <pre className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-3">
                    {[
                      ticket.report,
                      ticket.resolution_notes ? `--- Resolução ---\n${ticket.resolution_notes}` : null,
                    ].filter(Boolean).join('\n\n')}
                  </pre>
                )}
                {ticket.os_pdf_url && (
                  <a href={ticket.os_pdf_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-red hover:bg-brand-red-dark text-white font-semibold text-sm transition-colors">
                    <FileDown className="w-4 h-4" />
                    Ver Ordem de Serviço
                  </a>
                )}
              </div>
            ) : (
              <>
                {/* Histórico anterior */}
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
                  <StatusSelector value={form.status} onChange={v => patch({ status: v })} />
                </div>

                {/* Observação */}
                <div className="px-4 pb-3">
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Observacao
                    {form.status === 'pendente' && (
                      <span className="ml-1 font-normal text-slate-400">(sera adicionada ao historico)</span>
                    )}
                  </label>
                  <textarea rows={3} value={form.observacao}
                    onChange={e => patch({ observacao: e.target.value })}
                    placeholder={form.status === 'pendente' ? 'Ex: Aguardando material...' : 'O que foi realizado...'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 resize-none transition" />
                </div>

                {/* Áudio */}
                <div className="px-4 pb-3">
                  <p className="text-xs font-semibold text-slate-600 mb-2">
                    Audio <span className="font-normal text-slate-400">(opcional)</span>
                  </p>
                  {localAudioUrl ? (
                    <AudioPlayer url={localAudioUrl} />
                  ) : form.status === 'pendente' && (
                    <AudioRecorder ticketId={ticket.id} targetColumn="audio_url" onSaved={url => setLocalAudioUrl(url)} />
                  )}
                  {form.status === 'concluido' && (
                    <div className={localAudioUrl ? 'mt-2' : ''}>
                      {localResAudioUrl ? (
                        <AudioPlayer url={localResAudioUrl} />
                      ) : (
                        <AudioRecorder ticketId={ticket.id} targetColumn="resolution_audio_url" onSaved={url => setLocalResAudioUrl(url)} />
                      )}
                    </div>
                  )}
                </div>

                {/* Foto + Assinatura — apenas ao concluir */}
                {form.status === 'concluido' && (
                  <>
                    <div className="px-4 pb-3">
                      <p className="text-xs font-semibold text-slate-600 mb-2">
                        Foto <span className="font-normal text-slate-400">(opcional)</span>
                      </p>
                      <input ref={cameraInputRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                      {form.photoPreview ? (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200">
                          <img src={form.photoPreview} alt="Foto" className="w-full h-40 object-cover" />
                          <button type="button" onClick={removePhoto}
                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => cameraInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-[0.98]">
                            <Camera className="w-4 h-4" /> Tirar Foto
                          </button>
                          <button type="button" onClick={() => galleryInputRef.current?.click()}
                            title="Anexar foto da galeria"
                            className="flex items-center justify-center px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all active:scale-[0.98]">
                            <Image className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="px-4 pb-4">
                      <p className="text-xs font-semibold text-slate-600 mb-2">
                        Assinatura do cliente <span className="font-normal text-slate-400">(opcional)</span>
                      </p>
                      <SignatureCanvas ref={sigRef} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isConcluido && (
          <div className="shrink-0 bg-white border-t border-slate-200 p-4">
            <button type="button" disabled={submitting} onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-base rounded-2xl py-4 shadow-lg shadow-emerald-500/30 transition-all">
              {submitting
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Salvando...</>
                : <><CheckCircle2 className="w-5 h-5" /> SALVAR</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
