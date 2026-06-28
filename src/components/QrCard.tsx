import { useRef } from 'react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { Download } from 'lucide-react'
import { Button } from './ui/Button'

/**
 * On-screen QR is crisp SVG; a hidden high-res Canvas backs one-tap PNG export.
 * QR modules stay dark-on-white for reliable scanning — accent theming lives on the frame.
 */
export function QrCard({
  url,
  fileName = 'qr-code',
  size = 220,
}: {
  url: string
  fileName?: string
  size?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function downloadPng() {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${fileName}.png`
    a.click()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative rounded-[8px] bg-white p-4 shadow-[0_16px_42px_-18px_rgba(46,234,255,0.7)] ring-1 ring-demo-300/35">
        <div className="pointer-events-none absolute -left-1 -top-1 h-8 w-8 border-l-2 border-t-2 border-danger-500" />
        <div className="pointer-events-none absolute -bottom-1 -right-1 h-8 w-8 border-b-2 border-r-2 border-demo-400" />
        <QRCodeSVG value={url} size={size} level="M" marginSize={2} />
      </div>
      <QRCodeCanvas ref={canvasRef} value={url} size={512} level="M" marginSize={2} className="hidden" />
      <Button variant="outline" size="sm" onClick={downloadPng}>
        <Download className="size-4" />
        Save PNG
      </Button>
    </div>
  )
}
