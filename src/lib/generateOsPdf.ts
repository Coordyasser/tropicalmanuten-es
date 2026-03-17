import { jsPDF } from 'jspdf'
import { supabase } from './supabase'

export interface OsData {
  ticketId: string
  projectName: string
  unidade: string
  bloco: string | null
  clientName: string | null
  clientPhone: string | null
  osNumber: number
  complaintChannel: string | null
  scheduledDate: string   // ISO: YYYY-MM-DD
  scheduledTime: string | null // HH:MM
  description: string
  initialProvision: string | null
}

// ── Utils ──────────────────────────────────────────────────────────────────────

function isoToDMY(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function padOs(n: number): string {
  return String(n).padStart(2, '0')
}

async function logoAsBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo%20tropical.jpg.jpeg')
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ── PDF Builder ────────────────────────────────────────────────────────────────

export async function buildOsPdf(data: OsData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const L = 10   // left margin
  const W = 190  // total content width (210 - 10 - 10)

  // ── Drawing helpers ──────────────────────────────────────────────────────────

  /** Draw a stroked cell, optionally filled */
  function cell(x: number, y: number, w: number, h: number, fill?: [number, number, number]) {
    doc.setDrawColor(0)
    if (fill) {
      doc.setFillColor(...fill)
      doc.rect(x, y, w, h, 'FD')
    } else {
      doc.rect(x, y, w, h, 'S')
    }
  }

  /** Draw single-line text centred vertically in a cell */
  function cellText(
    text: string,
    x: number, y: number, w: number, h: number,
    opts: { size?: number; bold?: boolean; align?: 'left' | 'center' | 'right' } = {}
  ) {
    doc.setFontSize(opts.size ?? 8)
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setTextColor(0)
    const tx =
      opts.align === 'center' ? x + w / 2
      : opts.align === 'right'  ? x + w - 2
      : x + 2
    doc.text(text, tx, y + h / 2, { baseline: 'middle', align: opts.align ?? 'left' })
  }

  /** Draw wrapped text starting from top-left of a cell with 2mm padding */
  function wrappedCellText(text: string, x: number, y: number, w: number, size = 8.5) {
    doc.setFontSize(size)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)
    const lines = doc.splitTextToSize(text, w - 4) as string[]
    doc.text(lines, x + 2, y + 3, { baseline: 'top' })
  }

  // ── Layout constants ─────────────────────────────────────────────────────────

  const LBL_H  = 5.5  // label (header) row height
  const VAL1_H = 11   // section 1 value row height
  const VAL2_H = 13   // section 2 value row height
  const CONT_H = 99   // content (description) area height
  const F_LBL_H = 7   // footer label row height
  const F_CNT_H = 57  // footer content area height
  const F_DT_H  = 8   // footer "Data" row height

  // Column widths – each row sums to W=190
  function xPos(widths: number[]): number[] {
    const xs = [L]
    for (let i = 1; i < widths.length; i++) xs.push(xs[i - 1] + widths[i - 1])
    return xs
  }

  // Section 1 – 4 cols: Empreendimento | N°.Apto | Cliente | Contato
  const C1W = [67, 28, 50, 45] // Σ=190
  const C1X = xPos(C1W)

  // Section 2 – 5 cols: Data | Via | N°OS | Vistoria | Serviço
  const C2W = [28, 35, 22, 40, 65] // Σ=190
  const C2X = xPos(C2W)

  // Section 3 – 3 cols: Descrição | Providência | Realizado
  const C3W = [67, 67, 56] // Σ=190
  const C3X = xPos(C3W)

  // Footer – 4 cols: Vistoriadores | Aprovado | Concluídos | Termo
  const FW  = [37, 37, 37, 79] // Σ=190
  const FX  = xPos(FW)

  // ── Load logo ────────────────────────────────────────────────────────────────

  const logo = await logoAsBase64()

  let y = 10

  // ── 1. HEADER ───────────────────────────────────────────────────────────────

  const HDR_H = 18
  cell(L,      y, 45,      HDR_H)
  cell(L + 45, y, W - 45,  HDR_H)

  if (logo) doc.addImage(logo, 'JPEG', L + 2, y + 2, 41, 14)

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(
    'ATENDIMENTO E SERVIÇO DE RECLAMAÇÕES',
    L + 45 + (W - 45) / 2, y + HDR_H / 2,
    { baseline: 'middle', align: 'center' }
  )
  y += HDR_H

  // ── 2. CLIENT INFO ──────────────────────────────────────────────────────────

  const ROW1_LABELS = ['Empreendimento', 'N°. Apto/Casa', 'Cliente', 'Contato']
  C1X.forEach((cx, i) => { cell(cx, y, C1W[i], LBL_H); cellText(ROW1_LABELS[i], cx, y, C1W[i], LBL_H, { size: 6.5 }) })
  y += LBL_H

  const unitLabel = data.bloco ? `${data.unidade}/${data.bloco}` : data.unidade
  const ROW1_VALUES = [data.projectName, unitLabel, data.clientName ?? '', data.clientPhone ?? '']
  C1X.forEach((cx, i) => {
    cell(cx, y, C1W[i], VAL1_H)
    cellText(ROW1_VALUES[i], cx, y, C1W[i], VAL1_H, { size: 9, bold: i < 2 })
  })
  y += VAL1_H

  // ── 3. OS INFO ──────────────────────────────────────────────────────────────

  const ROW2_LABELS = [
    'Data apresentada', 'Via da reclamação', 'N°. da O.S',
    'Agendado para vistoria', 'Agendado para serviço',
  ]
  C2X.forEach((cx, i) => { cell(cx, y, C2W[i], LBL_H); cellText(ROW2_LABELS[i], cx, y, C2W[i], LBL_H, { size: 6.5 }) })
  y += LBL_H

  const today = new Date()
  const todayDMY = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
  const scheduledStr = data.scheduledTime
    ? `${isoToDMY(data.scheduledDate)} às ${data.scheduledTime}.`
    : isoToDMY(data.scheduledDate)

  C2X.forEach((cx, i) => {
    if (i === 4) {
      // Yellow background – agendado para serviço
      cell(cx, y, C2W[i], VAL2_H, [255, 255, 0])
      cellText(scheduledStr, cx, y, C2W[i], VAL2_H, { size: 9, bold: true })
    } else {
      cell(cx, y, C2W[i], VAL2_H)
      if      (i === 0) cellText(todayDMY, cx, y, C2W[i], VAL2_H, { size: 9 })
      else if (i === 1) cellText(data.complaintChannel ?? '', cx, y, C2W[i], VAL2_H, { size: 9 })
      else if (i === 2) cellText(padOs(data.osNumber), cx, y, C2W[i], VAL2_H, { size: 13, bold: true, align: 'center' })
      // i === 3: agendado para vistoria – leave blank
    }
  })
  y += VAL2_H

  // ── 4. CONTENT AREA ─────────────────────────────────────────────────────────

  const ROW3_LABELS = ['Descrição da ocorrência', 'Providência', 'Serviço realizado']
  C3X.forEach((cx, i) => { cell(cx, y, C3W[i], LBL_H); cellText(ROW3_LABELS[i], cx, y, C3W[i], LBL_H, { size: 6.5 }) })
  y += LBL_H

  C3X.forEach((cx, i) => cell(cx, y, C3W[i], CONT_H))
  wrappedCellText(data.description, C3X[0], y, C3W[0])
  if (data.initialProvision) wrappedCellText(data.initialProvision, C3X[1], y, C3W[1])
  y += CONT_H

  // ── 5. FOOTER ───────────────────────────────────────────────────────────────

  const FOOTER_LABELS = ['Vistoriadores', 'Aprovado Tropical', 'Serviços concluídos', 'TERMO DE RECEBIMENTO DOS SERVIÇOS']
  FX.forEach((fx, i) => {
    cell(fx, y, FW[i], F_LBL_H)
    cellText(FOOTER_LABELS[i], fx, y, FW[i], F_LBL_H, {
      size: i === 3 ? 8 : 7,
      bold: i === 3,
      align: i === 3 ? 'center' : 'left',
    })
  })
  y += F_LBL_H

  // Left 3 cols – blank signature areas
  FX.slice(0, 3).forEach((fx, i) => cell(fx, y, FW[i], F_CNT_H))

  // TERMO col – text + signature line
  cell(FX[3], y, FW[3], F_CNT_H)
  const TERMO = 'Pelo presente termo, aceito os serviços prestados pela empresa Construtora e Imobiliária Tropical Ltda., para correção das falhas apontadas e corrigidas acima.'
  wrappedCellText(TERMO, FX[3], y, FW[3], 8)

  // Signature line inside TERMO box
  const sigY = y + F_CNT_H - 16
  doc.setDrawColor(0)
  doc.line(FX[3] + 3, sigY, FX[3] + FW[3] - 3, sigY)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0)
  doc.text('____/____/____', FX[3] + 5, sigY + 3, { baseline: 'top' })
  doc.text('Nome / Assinatura do proprietário ou responsável', FX[3] + FW[3] / 2, sigY + 3, { baseline: 'top', align: 'center' })

  y += F_CNT_H

  // "Data" row under left 3 cols
  FX.slice(0, 3).forEach((fx, i) => {
    cell(fx, y, FW[i], F_DT_H)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)
    doc.text('Data', fx + FW[i] / 2, y + F_DT_H / 2, { baseline: 'middle', align: 'center' })
  })
  y += F_DT_H

  // Rev. 00
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0)
  doc.text('Rev. 00', L, y + 5)

  return doc.output('blob')
}

// ── Upload ─────────────────────────────────────────────────────────────────────

export async function generateAndUploadOs(data: OsData): Promise<string | null> {
  try {
    const blob = await buildOsPdf(data)

    const projectSlug  = data.projectName.toUpperCase().replace(/\s+/g, '_')
    const unidadeSlug  = data.unidade.replace(/\s+/g, '_')
    const blocoSlug    = data.bloco ? `_${data.bloco.replace(/\s+/g, '_')}` : ''
    const fileName = `${projectSlug}_${unidadeSlug}${blocoSlug}_N_DA_OS_${padOs(data.osNumber)}.pdf`
    const path = `${data.ticketId}/${fileName}`

    const { data: uploaded, error } = await supabase.storage
      .from('os_pdfs')
      .upload(path, blob, { contentType: 'application/pdf' })

    if (error) { console.error('Erro ao enviar OS PDF:', error.message); return null }

    const { data: urlData } = supabase.storage.from('os_pdfs').getPublicUrl(uploaded.path)
    return urlData.publicUrl
  } catch (e) {
    console.error('Erro ao gerar OS PDF:', e)
    return null
  }
}
