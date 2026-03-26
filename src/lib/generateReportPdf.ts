import { jsPDF } from 'jspdf'
import type { AdminTicket } from '../hooks/useAdminTickets'

function isoToDMY(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function logoAsBase64(): Promise<string | null> {
  return fetchBase64('/logo%20tropical.jpg.jpeg')
}

function mimeFromDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:image\/([^;]+);/)
  if (!m) return 'JPEG'
  const t = m[1].toLowerCase()
  if (t === 'png') return 'PNG'
  if (t === 'gif') return 'GIF'
  return 'JPEG'
}

export async function generateTicketReport(ticket: AdminTicket): Promise<void> {
  // Pre-fetch images in parallel
  const [logo, photoData, signatureData] = await Promise.all([
    logoAsBase64(),
    ticket.photo_url     ? fetchBase64(ticket.photo_url)     : Promise.resolve(null),
    ticket.signature_url ? fetchBase64(ticket.signature_url) : Promise.resolve(null),
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const PH = 297
  const L  = 14
  const CW = 182   // 210 - 14*2
  let y = 14

  const RED:      [number, number, number] = [196, 24, 32]
  const DARK:     [number, number, number] = [30,  30,  30]
  const MUTED:    [number, number, number] = [90,  90,  90]
  const LIGHT_BG: [number, number, number] = [248, 248, 248]
  const BORDER:   [number, number, number] = [220, 220, 220]

  function ensureSpace(needed: number) {
    if (y + needed > PH - 16) { doc.addPage(); y = 14 }
  }

  function sectionHeader(title: string) {
    ensureSpace(10)
    doc.setFillColor(...RED)
    doc.rect(L, y, CW, 7, 'F')
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(title, L + 3, y + 3.7, { baseline: 'middle' })
    y += 9
  }

  function field(label: string, value: string | null | undefined) {
    if (!value) return
    ensureSpace(6)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(`${label}:`, L + 2, y, { baseline: 'top' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    const lines = doc.splitTextToSize(value, CW - 44) as string[]
    doc.text(lines, L + 42, y, { baseline: 'top' })
    y += Math.max(5.5, lines.length * 4.5)
  }

  function textBox(label: string, text: string | null | undefined) {
    if (!text) return
    ensureSpace(14)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(`${label}:`, L + 2, y, { baseline: 'top' })
    y += 5.5

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    const lines = doc.splitTextToSize(text, CW - 6) as string[]
    const boxH  = lines.length * 4.5 + 5
    ensureSpace(boxH)
    doc.setFillColor(...LIGHT_BG)
    doc.setDrawColor(...BORDER)
    doc.rect(L, y, CW, boxH, 'FD')
    doc.text(lines, L + 3, y + 3, { baseline: 'top' })
    y += boxH + 4
  }

  function addImage(dataUrl: string, label: string) {
    const mime  = mimeFromDataUrl(dataUrl)
    const maxW  = Math.min(CW, 120)
    // Estimate aspect; default to 3:2 if we can't measure
    const imgH  = 65
    ensureSpace(imgH + 14)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(`${label}:`, L + 2, y, { baseline: 'top' })
    y += 5.5
    try {
      doc.addImage(dataUrl, mime, L, y, maxW, imgH, undefined, 'FAST')
      y += imgH + 5
    } catch {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...MUTED)
      doc.text('[Imagem não disponível]', L + 2, y, { baseline: 'top' })
      y += 8
    }
  }

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.setDrawColor(...BORDER)
  doc.setFillColor(255, 255, 255)
  doc.rect(L, y, CW, 20, 'FD')

  if (logo) doc.addImage(logo, 'JPEG', L + 2, y + 3, 26, 14)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('RELATÓRIO DE MANUTENÇÃO', L + 32, y + 8, { baseline: 'middle' })

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)
  doc.text('Construtora e Imobiliária Tropical', L + 32, y + 14, { baseline: 'middle' })

  if (ticket.os_number != null) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...RED)
    const osStr = `O.S. Nº ${String(ticket.os_number).padStart(2, '0')}`
    doc.text(osStr, L + CW - 3, y + 10, { baseline: 'middle', align: 'right' })
  }

  y += 24

  // ── IDENTIFICAÇÃO ────────────────────────────────────────────────────────
  sectionHeader('IDENTIFICAÇÃO')
  field('Empreendimento', ticket.project?.name)
  field('Unidade', ticket.unidade)
  field('Bloco', ticket.bloco)
  field('Nº da O.S.', ticket.os_number != null ? String(ticket.os_number).padStart(2, '0') : null)
  field('Técnico', ticket.technician?.name)
  y += 3

  // ── ABERTURA ────────────────────────────────────────────────────────────
  sectionHeader('ABERTURA')
  field('Cliente', ticket.client_name)
  field('Contato', ticket.client_phone)
  field('Via da reclamação', ticket.complaint_channel)
  field('Data agendada', isoToDMY(ticket.scheduled_date))
  field('Categoria', ticket.categoria)
  y += 2
  textBox('Descrição', ticket.description)
  textBox('Providência inicial', ticket.initial_provision)

  // ── DIAGNÓSTICO ──────────────────────────────────────────────────────────
  sectionHeader('DIAGNÓSTICO')
  textBox('Observações do técnico', ticket.report)
  textBox('Transcrição do áudio de diagnóstico', ticket.audio_transcription)
  if (!ticket.resolution_notes && photoData) addImage(photoData, 'Foto do diagnóstico')

  // ── CONCLUSÃO ────────────────────────────────────────────────────────────
  if (ticket.status === 'concluido' || ticket.resolution_notes) {
    sectionHeader('CONCLUSÃO')
    textBox('Relatório final', ticket.resolution_notes)
    textBox('Transcrição do áudio de conclusão', ticket.resolution_audio_transcription)
    if (ticket.resolution_notes && photoData) addImage(photoData, 'Foto da conclusão')
    if (signatureData) addImage(signatureData, 'Assinatura do cliente')
  }

  // ── Download ─────────────────────────────────────────────────────────────
  const slug  = (ticket.project?.name ?? 'relatorio').replace(/\s+/g, '_').toUpperCase()
  const und   = (ticket.unidade ?? '').replace(/\s+/g, '_')
  const osNum = ticket.os_number != null ? `_OS_${String(ticket.os_number).padStart(2, '0')}` : ''
  doc.save(`Relatorio_${slug}_${und}${osNum}.pdf`)
}
