import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Maximize, Trash2, X, Check } from 'lucide-react'

export interface SignatureCanvasHandle {
  getDataURL: () => string
  clear: () => void
  isEmpty: () => boolean
}

// ── Shared drawing hook ────────────────────────────────────────────────────────
function useDrawing(canvasRef: React.RefObject<HTMLCanvasElement | null>, onDraw?: () => void) {
  const isDrawing = useRef(false)
  const lastPos   = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr  = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width  = rect.width  * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
  }, [canvasRef])

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDrawing.current = true
    lastPos.current   = getPos(e)
    onDraw?.()
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current || !lastPos.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  function onPointerUp() { isDrawing.current = false; lastPos.current = null }

  return { onPointerDown, onPointerMove, onPointerUp }
}

// ── FullscreenSignatureModal ───────────────────────────────────────────────────
interface FullscreenModalProps {
  onConfirm: (dataUrl: string) => void
  onClose:   () => void
}

function FullscreenSignatureModal({ onConfirm, onClose }: FullscreenModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [empty, setEmpty] = useState(true)
  const drawing = useDrawing(canvasRef, () => setEmpty(false))

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Re-init canvas after modal mounts (size is now known)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr  = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width  = rect.width  * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
  }, [])

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setEmpty(true)
  }

  function confirm() {
    onConfirm(canvasRef.current?.toDataURL('image/png') ?? '')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <p className="text-sm font-semibold text-slate-700">Assinatura do cliente</p>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative bg-slate-50 m-3 rounded-2xl border-2 border-dashed border-slate-300 overflow-hidden">
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-slate-400 text-base select-none">Assine aqui</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
          onPointerDown={drawing.onPointerDown}
          onPointerMove={drawing.onPointerMove}
          onPointerUp={drawing.onPointerUp}
          onPointerLeave={drawing.onPointerUp}
        />
      </div>

      {/* Footer */}
      <div className="shrink-0 flex gap-3 px-4 pb-8 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={clearCanvas}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm transition-colors active:scale-[0.98]"
        >
          <Trash2 className="w-4 h-4" />
          Limpar
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={empty}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors active:scale-[0.98]"
        >
          <Check className="w-4 h-4" />
          Confirmar Assinatura
        </button>
      </div>
    </div>
  )
}

// ── SignatureCanvas ────────────────────────────────────────────────────────────
const SignatureCanvas = forwardRef<SignatureCanvasHandle>((_, ref) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const [empty,     setEmpty]     = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  // Stores the confirmed dataURL from the fullscreen modal
  const [confirmed, setConfirmed] = useState<string | null>(null)

  const drawing = useDrawing(canvasRef, () => setEmpty(false))

  useImperativeHandle(ref, () => ({
    getDataURL: () => {
      if (confirmed) return confirmed
      return canvasRef.current?.toDataURL('image/png') ?? ''
    },
    clear: () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      setEmpty(true)
      setConfirmed(null)
    },
    isEmpty: () => empty && !confirmed,
  }))

  function clearSmall() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setEmpty(true)
    setConfirmed(null)
  }

  function handleConfirm(dataUrl: string) {
    setConfirmed(dataUrl)
    setEmpty(false)
    setFullscreen(false)
    // Draw the confirmed signature into the small canvas preview
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr  = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width  = rect.width  * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const img = new Image()
    img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height)
    img.src = dataUrl
  }

  return (
    <>
      <div className="space-y-2">
        <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden"
          style={{ height: '140px' }}>

          {empty && !confirmed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-slate-400 text-sm select-none">Assine aqui</span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
            onPointerDown={drawing.onPointerDown}
            onPointerMove={drawing.onPointerMove}
            onPointerUp={drawing.onPointerUp}
            onPointerLeave={drawing.onPointerUp}
          />

          {/* Fullscreen button — after canvas so it sits above it in stacking order */}
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            title="Tela cheia"
            className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-white/80 hover:bg-white border border-slate-200 text-slate-500 hover:text-brand-red transition-colors shadow-sm"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={clearSmall}
          className="flex items-center gap-1.5 text-slate-400 hover:text-red-500 text-xs transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Limpar assinatura
        </button>
      </div>

      {fullscreen && (
        <FullscreenSignatureModal
          onConfirm={handleConfirm}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  )
})

SignatureCanvas.displayName = 'SignatureCanvas'

export default SignatureCanvas
