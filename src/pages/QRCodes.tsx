import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Copy, Gamepad2, Info, ScanLine, Send, Share2, type LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { useAsync } from '../lib/useAsync'
import { fetchActiveProducts } from '../lib/queries'
import { safeBuildAttributedPaymentLink, safeBuildDemoUrl } from '../lib/attribution'
import { copyText, shareOrCopy } from '../lib/share'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { QrCard } from '../components/QrCard'
import { staggerItem, staggerParent } from '../lib/motion'
import { cn } from '../lib/cn'
import type { Product } from '../lib/database.types'

type Tone = 'demo' | 'money' | 'primary'

function slug(s: string | undefined): string {
  return (s ?? 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const toneChip: Record<Tone, string> = {
  demo: 'bg-demo-400/13 text-demo-200 ring-demo-300/24',
  money: 'bg-money-400/13 text-money-100 ring-money-300/24',
  primary: 'bg-primary-400/15 text-primary-100 ring-primary-300/24',
}

export function QRCodes() {
  const { profile } = useAuth()
  const products = useAsync(fetchActiveProducts, [])
  const repCode = profile?.rep_code ?? ''
  const demoUrl = safeBuildDemoUrl(import.meta.env.VITE_DEMO_URL, repCode)

  const list = products.data ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = list.find((p) => p.id === selectedId) ?? list[0] ?? null
  const checkoutUrl = selected ? safeBuildAttributedPaymentLink(selected.stripe_payment_link, repCode) : null

  return (
    <div className="flex flex-col gap-6">
      <header className="glass-strong scanline-mask relative overflow-hidden rounded-[8px] p-5">
        <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-demo-400/18 blur-3xl" />
        <p className="text-xs font-black uppercase tracking-[0.22em] text-demo-300">Scan, sell, get credited</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold leading-none tracking-[-0.05em] text-chrome">
          Your QR codes
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-white/58">
          Demo, purchase, and referral paths all carry{' '}
          <span className="font-mono font-bold text-demo-100 tnum">{repCode || 'your rep code'}</span>.
        </p>
      </header>

      {products.loading ? (
        <ChannelSkeleton />
      ) : (
        <motion.div variants={staggerParent} initial="initial" animate="animate" className="flex flex-col gap-5">
          <ChannelCard
            tone="demo"
            icon={Gamepad2}
            eyebrow="Top of funnel"
            title="Demo"
            description="Let a prospect try the live game. The URL is tagged to you with ref."
          >
            {demoUrl ? (
              <QrAndActions url={demoUrl} fileName={`demo-${repCode}`} title="Try the demo" />
            ) : (
              <ConfigNote text="Set VITE_DEMO_URL in the environment to enable the demo QR." />
            )}
          </ChannelCard>

          {list.length > 1 && (
            <ProductPicker products={list} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          )}

          <ChannelCard
            tone="money"
            icon={ScanLine}
            eyebrow="In person"
            title="Customer purchase"
            description={
              selected
                ? `Have the buyer scan to purchase ${selected.name} now.`
                : 'Add a product to enable the purchase QR.'
            }
          >
            {checkoutUrl ? (
              <QrAndActions
                url={checkoutUrl}
                fileName={`buy-${slug(selected?.name)}-${repCode}`}
                title={selected?.name}
              />
            ) : (
              <ConfigNote text="No valid product checkout link yet." />
            )}
          </ChannelCard>

          <ChannelCard
            tone="primary"
            icon={Send}
            eyebrow="Remote prospect"
            title="Personal referral"
            description="For buyers who are not standing next to you. Send this and keep attribution intact."
          >
            {checkoutUrl ? (
              <LinkCard url={checkoutUrl} title={selected?.name} />
            ) : (
              <ConfigNote text="No valid product checkout link yet." />
            )}
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-white/42">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              This currently uses the same attributed checkout link as Customer purchase.
            </p>
          </ChannelCard>
        </motion.div>
      )}
    </div>
  )
}

function ChannelCard({
  tone,
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  tone: Tone
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <motion.div variants={staggerItem}>
      <GlassCard className="p-5">
        <div className="relative flex items-start gap-3">
          <span className={cn('grid size-11 shrink-0 place-items-center rounded-[8px] ring-1 ring-inset', toneChip[tone])}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/38">{eyebrow}</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.04em] text-white">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/56">{description}</p>
          </div>
        </div>
        <div className="relative mt-5">{children}</div>
      </GlassCard>
    </motion.div>
  )
}

function QrAndActions({ url, fileName, title }: { url: string; fileName: string; title?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <QrCard url={url} fileName={fileName} />
      <LinkActions url={url} title={title} />
    </div>
  )
}

function LinkCard({ url, title }: { url: string; title?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-[8px] border border-white/10 bg-black/28 px-3 py-2.5">
        <span className="truncate font-mono text-xs text-white/48">{url}</span>
      </div>
      <LinkActions url={url} title={title} />
    </div>
  )
}

function LinkActions({ url, title }: { url: string; title?: string }) {
  const { show } = useToast()
  return (
    <div className="grid w-full grid-cols-2 gap-2">
      <Button
        variant="demo"
        onClick={async () => {
          const r = await copyText(url)
          show(r === 'failed' ? 'Could not copy' : 'Link copied', r === 'failed' ? 'error' : 'success')
        }}
      >
        <Copy className="size-4" />
        Copy link
      </Button>
      <Button
        variant="outline"
        onClick={async () => {
          const r = await shareOrCopy({ title, url })
          show(
            r === 'failed' ? 'Could not share' : r === 'shared' ? 'Shared' : 'Copied',
            r === 'failed' ? 'error' : 'success',
          )
        }}
      >
        <Share2 className="size-4" />
        Share
      </Button>
    </div>
  )
}

function ProductPicker({
  products,
  selectedId,
  onSelect,
}: {
  products: Product[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {products.map((p) => {
        const active = p.id === selectedId
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition',
              active
                ? 'border-money-300/50 bg-money-400 text-[#03110c] shadow-[0_12px_24px_-18px_rgba(0,201,139,0.9)]'
                : 'border-white/10 bg-white/[0.06] text-white/58 hover:bg-white/[0.10] hover:text-white',
            )}
          >
            {p.name}
          </button>
        )
      })}
    </div>
  )
}

function ConfigNote({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] border border-warn-400/24 bg-warn-400/12 px-3 py-2.5 text-sm font-semibold text-warn-100">
      <Info className="size-4 shrink-0" />
      {text}
    </div>
  )
}

function ChannelSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="glass rounded-[8px] p-5">
          <div className="flex gap-3">
            <Skeleton className="size-11 rounded-[8px]" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-5 w-40" />
            </div>
          </div>
          <Skeleton className="mx-auto mt-4 size-52 rounded-[8px]" />
        </div>
      ))}
    </div>
  )
}
