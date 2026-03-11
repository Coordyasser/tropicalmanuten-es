import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Trash2 } from 'lucide-react'

export interface SignatureCanvasHandle {
  getDataURL: () => string
  clear: () => void
  isEmpty: () => boolean
}

const SignatureCanvas = forwardRef<SignatureCanvasHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  // Set up canvas resolution for crisp rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useImperativeHandle(ref, () => ({
    getDataURL: () => canvasRef.current?.toDataURL('image/png') ?? '',
    clear: () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
      setEmpty(true)
    },
    isEmpty: () => empty,
  }))

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDrawing.current = true
    lastPos.current = getPos(e)
    setEmpty(false)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current || !lastPos.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  function onPointerUp() {
    isDrawing.current = false
    lastPos.current = null
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden"
        style={{ height: '140px' }}>
        {/* Placeholder text */}
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-slate-400 text-sm select-none">Assine aqui</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          const canvas = canvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext('2d')
          ctx?.clearRect(0, 0, canvas.width, canvas.height)
          setEmpty(true)
        }}
        className="flex items-center gap-1.5 text-slate-400 hover:text-red-500 text-xs transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Limpar assinatura
      </button>
    </div>
  )
})

SignatureCanvas.displayName = 'SignatureCanvas'

export default SignatureCanvas
