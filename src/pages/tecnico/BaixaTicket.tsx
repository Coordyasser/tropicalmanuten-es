import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, Camera, CheckCircle2, Clock,
  Images, Loader2, Lock, MapPin, Mic, MicOff, Paperclip, Timer, Trash2, Volume2, X,
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

function parseScheduledAt(date: string, time: string | null): Date {
  if (!date) return new Date(NaN)
  const hhmm = time ? time.slice(0, 5) : '00:00'
  const dt   = new Date(`${date}T${hhmm}:00`)
  return isNaN(dt.getTime()) ? new Date(`${date}T00:00:00`) : dt
}

function formatElapsed(startAt: Date, endAt: Date): string {
  const diffMs = endAt.getTime() - startAt.getTime()
  if (diffMs < 0) return '—'
  const totalMins = Math.floor(diffMs / 60_000)
  if (totalMins < 1) return '< 1min'
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h ${m}min`
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

function mostRecentEditableId(tickets: TicketWithRelations[]): string | null {
  const editable = tickets.filter(t => t.status !== 'concluido')
  if (editable.length === 0) return null
  return editable.reduce((best, t) => {
    const bKey = best.scheduled_date + (best.scheduled_time ?? '')
    const tKey = t.scheduled_date   + (t.scheduled_time   ?? '')
    return tKey >= bKey ? t : best
  }).id
}

/** Extrai o caminho de storage a partir da URL pública e deleta o arquivo + limpa a coluna no DB. */
async function deleteAudio(
  ticketId: string,
  column: 'audio_url' | 'resolution_audio_url',
  url: string,
): Promise<void> {
  const marker = '/audios/'
  const idx = url.indexOf(marker)
  if (idx !== -1) {
    const storagePath = url.slice(idx + marker.length).split('?')[0]
    await supabase.storage.from('audios').remove([storagePath])
  }
  await supabase.from('tickets').update({ [column]: null }).eq('id', ticketId)
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

// ── ElapsedBadge ──────────────────────────────────────────────────────────────
function ElapsedBadge({ ticket }: { ticket: TicketWithRelations }) {
  const [, tick] = useState(0)
  const startAt  = parseScheduledAt(ticket.scheduled_date, ticket.scheduled_time)
  const isFixed  = Boolean(ticket.completed_at)

  useEffect(() => {
    if (isFixed) return
    const id = setInterval(() => tick(n => n + 1), 60_000)
    return () => clearInterval(id)
  }, [isFixed])

  const endAt   = isFixed ? new Date(ticket.completed_at!) : new Date()
  const label   = formatElapsed(startAt, endAt)
  const caption = isFixed ? 'Duração total' : 'Duração'

  return (
    <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 text-[11px] font-semibold shrink-0">
      <Timer className="w-3 h-3" />
      {caption}: {label}
    </div>
  )
}

// ── AudioPlayer ───────────────────────────────────────────────────────────────
export function AudioPlayer({ url, onDelete }: { url: string; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
      <Volume2 className="w-4 h-4 text-blue-500 shrink-0" />
      <audio controls src={url} className="flex-1 h-8 min-w-0" style={{ accentColor: '#C41820' }} />
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Excluir áudio"
          className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── AudioRecorder ─────────────────────────────────────────────────────────────
interface AudioRecorderProps {
  ticketId: string
  targetColumn: 'audio_url' | 'resolution_audio_url'
  onSaved: (url: string) => void
}

function AudioRecorder({ ticketId, targetColumn, onSaved }: AudioRecorderProps) {
  const [recording,  setRecording]  = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const mediaRef    = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); uploadBlob(mimeType) }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
    } catch {
      setError('Por favor, libere o acesso ao microfone nas configurações do navegador para gravar áudios.')
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    setRecording(false)
  }

  async function uploadBlob(mimeType: string, blob?: Blob) {
    setUploading(true)
    const ext      = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : mimeType.split('/')[1] ?? 'mp3'
    const filename = targetColumn === 'resolution_audio_url' ? `resolution.${ext}` : `audio.${ext}`
    const path     = `tickets/${ticketId}/${filename}`
    const data_blob = blob ?? new Blob(chunksRef.current, { type: mimeType })
    const { data, error: upErr } = await supabase.storage
      .from('audios')
      .upload(path, data_blob, { upsert: true, contentType: mimeType })
    if (upErr) { setError(`Erro ao enviar áudio: ${upErr.message}`); setUploading(false); return }
    const url = supabase.storage.from('audios').getPublicUrl(data.path).data.publicUrl
    await supabase.from('tickets').update({ [targetColumn]: url }).eq('id', ticketId)
    onSaved(url)
    setUploading(false)
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    await uploadBlob(file.type || 'audio/mpeg', file)
    // reset so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (uploading) {
    return (
      <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-semibold">
        <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
      </div>
    )
  }

  if (recording) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={stopRecording}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-red-500 hover:bg-red-600 text-white animate-pulse transition-all active:scale-[0.98]"
        >
          <MicOff className="w-4 h-4" /> Parar gravação
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={handleFileSelect} />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-[0.98]"
        >
          <Mic className="w-4 h-4" /> Gravar áudio
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-[0.98]"
        >
          <Paperclip className="w-4 h-4" /> Anexar áudio
        </button>
      </div>
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
    </div>
  )
}

// ── TicketItem ────────────────────────────────────────────────────────────────
interface TicketItemProps {
  ticket: TicketWithRelations
  form: TicketForm
  sigRef: React.Ref<SignatureCanvasHandle>
  onChange: (patch: Partial<TicketForm>) => void
  isQueueLocked: boolean
}

function TicketItem({ ticket, form, sigRef, onChange, isQueueLocked }: TicketItemProps) {
  const cameraInputRef  = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const isConcluido     = ticket.status === 'concluido'
  const isPendente    = ticket.status === 'pendente'

  // Local audio state — initialised from DB, cleared on delete, set on new upload
  const [localAudioUrl,    setLocalAudioUrl]    = useState(ticket.audio_url)
  const [localResAudioUrl, setLocalResAudioUrl] = useState(ticket.resolution_audio_url)
  const [deletingAudio,    setDeletingAudio]    = useState<'audio_url' | 'resolution_audio_url' | null>(null)

  async function handleDeleteAudio(column: 'audio_url' | 'resolution_audio_url', url: string) {
    setDeletingAudio(column)
    await deleteAudio(ticket.id, column, url)
    if (column === 'audio_url') setLocalAudioUrl(null)
    else setLocalResAudioUrl(null)
    setDeletingAudio(null)
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onChange({ photoFile: file, photoPreview: URL.createObjectURL(file), changed: true })
  }
  function removePhoto() {
    onChange({ photoFile: null, photoPreview: null })
    if (cameraInputRef.current)  cameraInputRef.current.value  = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  // ── Read-only: already concluded ──────────────────────────────────────────
  if (isConcluido) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden opacity-75">
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
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
            <Lock className="w-3 h-3" />
            Concluido
          </span>
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3 h-3" />{formatDate(ticket.scheduled_date)}
            {ticket.scheduled_time && ` às ${ticket.scheduled_time}`}
          </div>
          <ElapsedBadge ticket={ticket} />
        </div>
        {(ticket.report || ticket.resolution_notes) && (
          <div className="px-4 pb-3">
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Relatorio</p>
            <pre className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-3">
              {[
                ticket.report,
                ticket.resolution_notes ? `--- Resolução ---\n${ticket.resolution_notes}` : null,
              ].filter(Boolean).join('\n\n')}
            </pre>
          </div>
        )}
        {(ticket.audio_url || ticket.resolution_audio_url) && (
          <div className="px-4 pb-4">
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Audio</p>
            <div className="space-y-2">
              {ticket.audio_url         && <AudioPlayer url={ticket.audio_url} />}
              {ticket.resolution_audio_url && <AudioPlayer url={ticket.resolution_audio_url} />}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Read-only: queued ──────────────────────────────────────────────────────
  if (isQueueLocked) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden opacity-70">
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
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
            <Lock className="w-3 h-3" />
            Na fila
          </span>
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-2 items-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3 h-3" />{formatDate(ticket.scheduled_date)}
            {ticket.scheduled_time && ` às ${ticket.scheduled_time}`}
          </div>
          <ElapsedBadge ticket={ticket} />
        </div>
        <div className="mx-4 mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-[11px] text-amber-700 font-medium">
            Conclua o chamado mais recente deste local para desbloquear este.
          </p>
        </div>
      </div>
    )
  }

  // ── Editable view ──────────────────────────────────────────────────────────
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

      {/* Timer row */}
      <div className="px-4 pt-3 flex flex-wrap gap-2 items-center">
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3 h-3" />{formatDate(ticket.scheduled_date)}
          {ticket.scheduled_time && ` às ${ticket.scheduled_time}`}
        </div>
        <ElapsedBadge ticket={ticket} />
      </div>

      {/* Historico anterior */}
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

      {/* Observacao */}
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
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 resize-none transition" />
      </div>

      {/* Audio — diagnóstico (audio_url) sempre visível; resolução (resolution_audio_url) ao concluir */}
      <div className="px-4 pb-3">
        <p className="text-xs font-semibold text-slate-600 mb-2">
          Audio <span className="font-normal text-slate-400">(opcional)</span>
        </p>

        {/* Áudio de diagnóstico */}
        {localAudioUrl ? (
          <AudioPlayer
            url={localAudioUrl}
            onDelete={deletingAudio === 'audio_url' ? undefined : () => handleDeleteAudio('audio_url', localAudioUrl)}
          />
        ) : form.status === 'pendente' && (
          <AudioRecorder ticketId={ticket.id} targetColumn="audio_url" onSaved={url => setLocalAudioUrl(url)} />
        )}

        {/* Áudio de resolução — apenas ao concluir */}
        {form.status === 'concluido' && (
          <div className={localAudioUrl ? 'mt-2' : ''}>
            {localResAudioUrl ? (
              <AudioPlayer
                url={localResAudioUrl}
                onDelete={deletingAudio === 'resolution_audio_url' ? undefined : () => handleDeleteAudio('resolution_audio_url', localResAudioUrl)}
              />
            ) : (
              <AudioRecorder ticketId={ticket.id} targetColumn="resolution_audio_url" onSaved={url => setLocalResAudioUrl(url)} />
            )}
          </div>
        )}
      </div>

      {/* Foto + Assinatura — apenas quando Concluido */}
      {form.status === 'concluido' && (
        <>
          <div className="px-4 pb-3">
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Foto <span className="font-normal text-slate-400">(opcional)</span>
            </p>
            {/* input com capture → abre câmera diretamente */}
            <input ref={cameraInputRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
            {/* input sem capture → abre galeria */}
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
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-[0.98]">
                  <Camera className="w-4 h-4" /> Câmera
                </button>
                <button type="button" onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-[0.98]">
                  <Images className="w-4 h-4" /> Galeria
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
        <button onClick={() => navigate('/tecnico')} className="text-brand-red text-sm font-medium underline">Voltar</button>
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

  const editableId  = mostRecentEditableId(tickets)
  const hasEditable = editableId !== null

  function updateForm(id: string, patch: Partial<TicketForm>) {
    setForms(prev => { const m = new Map(prev); m.set(id, { ...prev.get(id)!, ...patch }); return m })
  }

  async function handleFinalizar() {
    setSubmitting(true)
    setSubmitError(null)

    if (!editableId) { navigate('/tecnico', { replace: true }); return }

    const editableTicket = tickets.find(t => t.id === editableId)!
    const form           = forms.get(editableId)!

    if (!form.changed) { navigate('/tecnico', { replace: true }); return }

    const isConcluding = form.status === 'concluido'
    const concludedAt  = new Date()
    const startAt      = parseScheduledAt(editableTicket.scheduled_date, editableTicket.scheduled_time)

    const olderPending = tickets
      .filter(t => t.status !== 'concluido' && t.id !== editableId)
      .sort((a, b) => {
        const aKey = a.scheduled_date + (a.scheduled_time ?? '')
        const bKey = b.scheduled_date + (b.scheduled_time ?? '')
        return aKey.localeCompare(bKey)
      })

    const isOldestInGroup = olderPending.length === 0

    // ── Photo upload ──────────────────────────────────────────────────────
    let photoUrl: string | null = editableTicket.photo_url
    if (isConcluding && form.photoFile) {
      const ext  = (form.photoFile.name.split('.').pop() ?? 'jpg').split('?')[0]
      const path = `tickets/${editableTicket.id}/photo.${ext}`
      const { data: upd, error: upe } = await supabase.storage
        .from('photos')
        .upload(path, form.photoFile, { upsert: true, contentType: form.photoFile.type || 'image/jpeg' })
      if (upe) { setSubmitError(`Erro ao enviar foto: ${upe.message}`); setSubmitting(false); return }
      if (upd) { photoUrl = supabase.storage.from('photos').getPublicUrl(upd.path).data.publicUrl }
    }

    // ── Signature upload ──────────────────────────────────────────────────
    let signatureUrl: string | null = editableTicket.signature_url
    const sigHandle = sigRefs.current.get(editableTicket.id) ?? null
    if (isConcluding && sigHandle && !sigHandle.isEmpty()) {
      const dataUrl = sigHandle.getDataURL()
      const blob    = await (await fetch(dataUrl)).blob()
      const { data: sigd, error: sige } = await supabase.storage
        .from('photos')
        .upload(`tickets/${editableTicket.id}/signature.png`, blob, { upsert: true, contentType: 'image/png' })
      if (sige) { setSubmitError(`Erro ao enviar assinatura: ${sige.message}`); setSubmitting(false); return }
      if (sigd) { signatureUrl = supabase.storage.from('photos').getPublicUrl(sigd.path).data.publicUrl }
    }

    // ── Report vs Resolution notes ────────────────────────────────────────
    let report: string | null = editableTicket.report
    let resolutionNotes: string | null = editableTicket.resolution_notes ?? null
    if (form.observacao.trim()) {
      if (isConcluding) {
        resolutionNotes = form.observacao.trim()
      } else {
        report = buildReport(form.observacao, editableTicket.report)
      }
    }

    // ── Save editable ticket ──────────────────────────────────────────────
    const updatePayload: Database['public']['Tables']['tickets']['Update'] = {
      status:        form.status,
      report,
      completed_at:  isConcluding ? concludedAt.toISOString() : null,
      duration:      isConcluding && isOldestInGroup
                       ? formatDuration(startAt, concludedAt)
                       : null,
      photo_url:     isConcluding ? photoUrl     : editableTicket.photo_url,
      signature_url: isConcluding ? signatureUrl : editableTicket.signature_url,
    }
    if (isConcluding) {
      updatePayload.resolution_notes = resolutionNotes
    }

    const { error: editErr } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', editableTicket.id)

    if (editErr) { setSubmitError(editErr.message); setSubmitting(false); return }

    // ── Cascade: close older pending tickets ──────────────────────────────
    if (isConcluding && olderPending.length > 0) {
      for (let i = 0; i < olderPending.length; i++) {
        const t        = olderPending[i]
        const isOldest = i === 0
        const tStart   = parseScheduledAt(t.scheduled_date, t.scheduled_time)
        const { error } = await supabase
          .from('tickets')
          .update({
            status:       'concluido',
            completed_at: concludedAt.toISOString(),
            duration:     isOldest ? formatDuration(tStart, concludedAt) : null,
          })
          .eq('id', t.id)
        if (error) { setSubmitError(error.message); setSubmitting(false); return }
      }
    }

    navigate('/tecnico', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="sticky top-0 z-10 bg-brand-red text-white px-4 pt-10 pb-4 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/tecnico')}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="text-white/60 text-xs">Baixa de Chamados</p>
            <h1 className="font-bold text-base truncate">{locationName}</h1>
            {locationDetail && <p className="text-white/60 text-xs truncate">{locationDetail}</p>}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
          <MapPin className="w-4 h-4 text-brand-red shrink-0" />
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

        {tickets.map(ticket => {
          const isQueueLocked = ticket.status !== 'concluido' && ticket.id !== editableId
          return (
            <TicketItem
              key={ticket.id}
              ticket={ticket}
              form={forms.get(ticket.id)!}
              sigRef={el => { sigRefs.current.set(ticket.id, el) }}
              onChange={patch => updateForm(ticket.id, patch)}
              isQueueLocked={isQueueLocked}
            />
          )
        })}

        {submitError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{submitError}</span>
          </div>
        )}
      </main>

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
