import { useState, useEffect } from 'react'
import { X, CalendarDays, ExternalLink, Loader2, MapPin, User, FileText, Camera, PenLine, Tag, Clock, Volume2, FileDown, Phone, MessageSquare, Hash, AlertTriangle, RefreshCw } from 'lucide-react'
import type { AdminTicket } from '../../hooks/useAdminTickets'
import { transcribeAudio } from '../../lib/transcribeAudio'
import { generateTicketReport } from '../../lib/generateReportPdf'
import { generateAndUploadOs } from '../../lib/generateOsPdf'
import { supabase } from '../../lib/supabase'

interface TicketDetailModalProps {
  ticket: AdminTicket | null
  onClose: () => void
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function formatTime(t: string | null): string { return t ? t.slice(0, 5) : '' }

function StatusBadge({ status }: { status: AdminTicket['status'] }) {
  const cfg = status === 'concluido'
    ? { bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Concluido' }
    : status === 'pendente'
    ? { bg: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-400',  label: 'Pendente'  }
    : { bg: 'bg-slate-100 text-slate-600',     dot: 'bg-slate-400',   label: 'Aberto'    }
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${cfg.bg}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function PhotoPreview({ url, label = 'Foto' }: { url: string; label?: string }) {
  const [error, setError] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-600">{label}</span>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors">
          <ExternalLink className="w-3.5 h-3.5" /> Abrir original
        </a>
      </div>
      {error ? (
        <div className="w-full h-32 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Camera className="w-8 h-8" />
          <p className="text-xs">Nao foi possivel carregar a imagem</p>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline">Ver URL</a>
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img src={url} alt="Foto do chamado" onError={() => setError(true)}
            className="w-full rounded-xl border border-slate-200 object-cover max-h-72 hover:opacity-90 transition-opacity cursor-zoom-in" />
        </a>
      )}
    </div>
  )
}

function AudioWithTranscription({
  url,
  initialTranscription,
  ticketId,
  column,
}: {
  url: string
  initialTranscription: string | null
  ticketId: string
  column: 'audio_transcription' | 'resolution_audio_transcription'
}) {
  const [transcription, setTranscription] = useState<string | null>(initialTranscription)
  const [transcribing, setTranscribing]   = useState(false)

  async function handleTranscribe() {
    setTranscribing(true)
    try {
      const res  = await fetch(url)
      const blob = await res.blob()
      const text = await transcribeAudio(blob, blob.type || 'audio/webm')
      if (text) {
        setTranscription(text)
        supabase.from('tickets').update({ [column]: text }).eq('id', ticketId).then()
      }
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
        <Volume2 className="w-4 h-4 text-blue-500 shrink-0" />
        <audio controls src={url} className="flex-1 h-8 min-w-0" />
      </div>
      {transcription ? (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Transcrição do Áudio</p>
          <pre className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed bg-blue-50 border border-blue-100 rounded-xl p-3">{transcription}</pre>
        </div>
      ) : (
        <button onClick={handleTranscribe} disabled={transcribing}
          className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 disabled:opacity-60 transition-colors">
          {transcribing
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Transcrevendo...</>
            : '✦ Transcrever áudio'}
        </button>
      )}
    </div>
  )
}

export default function TicketDetailModal({ ticket, onClose }: TicketDetailModalProps) {
  const [generatingPdf,   setGeneratingPdf]   = useState(false)
  const [regeningOs,      setRegeningOs]      = useState(false)
  const [regenOsError,    setRegenOsError]    = useState<string | null>(null)
  const [localOsPdfUrl,   setLocalOsPdfUrl]   = useState<string | null>(ticket?.os_pdf_url ?? null)

  // Sincroniza sempre que um ticket diferente for aberto ou os_pdf_url mudar no prop
  useEffect(() => {
    setLocalOsPdfUrl(ticket?.os_pdf_url || null)
  }, [ticket?.id, ticket?.os_pdf_url])

  if (!ticket) return null

  async function handleRegenOsPdf() {
    if (!ticket || ticket.os_number == null) return
    setRegeningOs(true)
    setRegenOsError(null)
    try {
      const url = await generateAndUploadOs({
        ticketId:         ticket.id,
        projectName:      ticket.project?.name      ?? '',
        unidade:          ticket.unidade             ?? '',
        bloco:            ticket.bloco               ?? null,
        clientName:       ticket.client_name         ?? null,
        clientPhone:      ticket.client_phone        ?? null,
        osNumber:         ticket.os_number,
        complaintChannel: ticket.complaint_channel   ?? null,
        scheduledDate:    ticket.scheduled_date,
        scheduledTime:    ticket.scheduled_time      ?? null,
        description:      ticket.description,
        initialProvision: ticket.initial_provision   ?? null,
      })
      await supabase.from('tickets').update({ os_pdf_url: url }).eq('id', ticket.id)
      setLocalOsPdfUrl(url)
    } catch (e) {
      setRegenOsError(e instanceof Error ? e.message : 'Erro ao gerar PDF da O.S.')
    } finally {
      setRegeningOs(false)
    }
  }

  async function handleDownloadReport() {
    if (!ticket) return
    setGeneratingPdf(true)
    try {
      // Busca dados frescos para garantir que audio_transcription está atualizado
      const { data } = await supabase
        .from('tickets')
        .select(`
          id, project_id, tech_id, scheduled_date, scheduled_time,
          description, unidade, bloco, categoria,
          status, report, photo_url, diagnostic_photo_url, signature_url,
          audio_url, audio_transcription,
          resolution_notes, resolution_audio_url, resolution_audio_transcription,
          client_name, client_phone, complaint_channel, initial_provision,
          os_number, os_pdf_url,
          project:projects ( name ),
          technician:profiles ( id, name )
        `)
        .eq('id', ticket.id)
        .single()
      await generateTicketReport((data ?? ticket) as AdminTicket)
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="font-bold text-slate-800">Detalhes do Chamado</h2>
            <p className="text-slate-400 text-xs mt-0.5 font-mono">{ticket.id.slice(0, 8)}...</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Status</span>
            <StatusBadge status={ticket.status} />
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 gap-3">

            {/* OS Number */}
            {ticket.os_number != null && (
              <div className="flex items-start gap-3 p-3 bg-brand-red/5 border border-brand-red/20 rounded-xl">
                <Hash className="w-4 h-4 text-brand-red mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Nº da O.S.</p>
                  <p className="text-slate-700 text-sm font-bold">
                    {String(ticket.os_number).padStart(2, '0')}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <CalendarDays className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 font-medium">Data agendada</p>
                <p className="text-slate-700 text-sm font-medium">
                  {formatDate(ticket.scheduled_date)}
                  {ticket.scheduled_time && (
                    <span className="ml-2 inline-flex items-center gap-1 text-slate-400 font-normal text-xs">
                      <Clock className="w-3 h-3" />{formatTime(ticket.scheduled_time)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 font-medium">Local</p>
                <p className="text-slate-700 text-sm font-medium">
                  {ticket.project?.name ?? '—'}
                  {ticket.unidade && (
                    <span className="text-slate-400 font-normal"> — Unid. {ticket.unidade}</span>
                  )}
                  {ticket.bloco && (
                    <span className="text-slate-400 font-normal"> / Bl. {ticket.bloco}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <User className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 font-medium">Tecnico responsavel</p>
                <p className="text-slate-700 text-sm font-medium">{ticket.technician?.name ?? '—'}</p>
              </div>
            </div>

            {/* Client info */}
            {(ticket.client_name || ticket.client_phone) && (
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <Phone className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Cliente</p>
                  {ticket.client_name && <p className="text-slate-700 text-sm font-medium">{ticket.client_name}</p>}
                  {ticket.client_phone && <p className="text-slate-500 text-xs">{ticket.client_phone}</p>}
                </div>
              </div>
            )}

            {/* Via da reclamação */}
            {ticket.complaint_channel && (
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Via da reclamação</p>
                  <p className="text-slate-700 text-sm font-medium">{ticket.complaint_channel}</p>
                </div>
              </div>
            )}

            {/* Tipo de Chamado */}
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <Tag className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 font-medium">Tipo de Chamado</p>
                <span className={[
                  'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5',
                  ticket.ticket_type === 'vistoria'
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-blue-100 text-blue-700',
                ].join(' ')}>
                  <span className={['w-1.5 h-1.5 rounded-full',
                    ticket.ticket_type === 'vistoria' ? 'bg-teal-500' : 'bg-blue-500',
                  ].join(' ')} />
                  {ticket.ticket_type === 'vistoria' ? 'Vistoria' : 'Manutenção'}
                </span>
              </div>
            </div>

            {ticket.categoria && (
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <Tag className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Categoria</p>
                  <p className="text-slate-700 text-sm font-medium">{ticket.categoria}</p>
                </div>
              </div>
            )}
          </div>

          {/* Providência inicial */}
          {ticket.initial_provision && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-600">Providência inicial</span>
              </div>
              <p className="text-slate-700 text-sm leading-relaxed bg-slate-50 rounded-xl p-3">{ticket.initial_provision}</p>
            </div>
          )}

          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-600">Descricao</span>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed bg-slate-50 rounded-xl p-3">{ticket.description}</p>
          </div>

          {/* Report + Resolution notes */}
          {(ticket.report || ticket.resolution_notes) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-slate-600">Relatorio do tecnico</span>
              </div>
              <pre className="text-slate-700 text-sm leading-relaxed bg-emerald-50 rounded-xl p-3 whitespace-pre-wrap font-sans">
                {[
                  ticket.report,
                  ticket.resolution_notes ? `--- Resolução ---\n${ticket.resolution_notes}` : null,
                ].filter(Boolean).join('\n\n')}
              </pre>
            </div>
          )}

          {/* Photos */}
          {ticket.diagnostic_photo_url && <PhotoPreview url={ticket.diagnostic_photo_url} label="Foto do diagnóstico" />}
          {ticket.photo_url            && <PhotoPreview url={ticket.photo_url}            label="Foto da conclusão"   />}

          {/* Signature */}
          {ticket.signature_url && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <PenLine className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-600">Assinatura do cliente</span>
              </div>
              <img src={ticket.signature_url} alt="Assinatura"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 object-contain max-h-32" />
            </div>
          )}

          {/* Audio */}
          {(ticket.audio_url || ticket.resolution_audio_url) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-600">Audio</span>
              </div>
              <div className="space-y-3">
                {ticket.audio_url && (
                  <AudioWithTranscription
                    url={ticket.audio_url}
                    initialTranscription={ticket.audio_transcription ?? null}
                    ticketId={ticket.id}
                    column="audio_transcription"
                  />
                )}
                {ticket.resolution_audio_url && (
                  <AudioWithTranscription
                    url={ticket.resolution_audio_url}
                    initialTranscription={ticket.resolution_audio_transcription ?? null}
                    ticketId={ticket.id}
                    column="resolution_audio_transcription"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2">
          {/* Alerta se regeneração falhou */}
          {regenOsError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{regenOsError}</p>
            </div>
          )}

          <div className="flex gap-3">
            {localOsPdfUrl ? (
              <a href={localOsPdfUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-brand-red hover:bg-brand-red-dark text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <FileDown className="w-4 h-4" />
                Ver O.S.
              </a>
            ) : ticket.os_number != null ? (
              <button
                onClick={handleRegenOsPdf}
                disabled={regeningOs}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {regeningOs
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando O.S....</>
                  : <><RefreshCw className="w-4 h-4" /> Gerar O.S.</>}
              </button>
            ) : null}
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium">
              Fechar
            </button>
          </div>
          <button
            onClick={handleDownloadReport}
            disabled={generatingPdf}
            className="w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {generatingPdf
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando PDF...</>
              : <><FileDown className="w-4 h-4" /> Baixar Relatório (PDF)</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
