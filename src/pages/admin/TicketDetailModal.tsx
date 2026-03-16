import { useState } from 'react'
import { X, CalendarDays, ExternalLink, MapPin, User, FileText, Camera, PenLine, Tag, Clock, Volume2 } from 'lucide-react'
import type { AdminTicket } from '../../hooks/useAdminTickets'

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

function PhotoPreview({ url }: { url: string }) {
  const [error, setError] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-600">Foto</span>
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

export default function TicketDetailModal({ ticket, onClose }: TicketDetailModalProps) {
  if (!ticket) return null

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

          {/* Photo */}
          {ticket.photo_url && <PhotoPreview url={ticket.photo_url} />}

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
              <div className="space-y-2">
                {ticket.audio_url && (
                  <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
                    <Volume2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <audio controls src={ticket.audio_url} className="flex-1 h-8 min-w-0" />
                  </div>
                )}
                {ticket.resolution_audio_url && (
                  <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
                    <Volume2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <audio controls src={ticket.resolution_audio_url} className="flex-1 h-8 min-w-0" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
