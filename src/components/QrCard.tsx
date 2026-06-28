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
      <div className="rounded-3xl bg-white p-4 shadow-[0_12px_34px_-14px_rgba(15,23,42,0.3)] ring-1 ring-slate-100">
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
