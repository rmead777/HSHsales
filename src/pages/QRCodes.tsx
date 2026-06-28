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
  demo: 'bg-demo-50 text-demo-600 ring-demo-100',
  money: 'bg-money-50 text-money-600 ring-money-100',
  primary: 'bg-primary-50 text-primary-600 ring-primary-200',
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
      <header>
        <p className="text-sm font-medium text-slate-400">Scan, sell, get credited</p>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-slate-900">Your QR codes</h1>
        <p className="mt-1 text-sm text-slate-500">
          All three carry your code{' '}
          <span className="font-mono font-semibold text-primary-600">{repCode}</span>.
        </p>
      </header>

      {products.loading ? (
        <ChannelSkeleton />
      ) : (
        <motion.div variants={staggerParent} initial="initial" animate="animate" className="flex flex-col gap-5">
          {/* Demo — top of funnel */}
          <ChannelCard
            tone="demo"
            icon={Gamepad2}
            eyebrow="Top of funnel"
            title="Demo"
            description="Let a prospect try the live game. Tagged to you via ?ref."
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

          {/* Customer purchase — in person, scan now */}
          <ChannelCard
            tone="money"
            icon={ScanLine}
            eyebrow="In person"
            title="Customer purchase"
            description={
              selected
                ? `Have the buyer scan to purchase “${selected.name}” now — credited to you.`
                : 'Add a product to enable this.'
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

          {/* Personal referral — remote prospect, copyable link */}
          <ChannelCard
            tone="primary"
            icon={Send}
            eyebrow="Remote prospect"
            title="Personal referral"
            description="For buyers who aren't with you — send this link. Still tagged to you."
          >
            {checkoutUrl ? (
              <LinkCard url={checkoutUrl} title={selected?.name} />
            ) : (
              <ConfigNote text="No valid product checkout link yet." />
            )}
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-slate-400">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Defaults to the same checkout link as Customer purchase. This can be repointed to a
              landing page later.
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
        <div className="flex items-start gap-3">
          <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl ring-1 ring-inset', toneChip[tone])}>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{eyebrow}</p>
            <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-slate-900">{title}</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{description}</p>
          </div>
        </div>
        <div className="mt-4">{children}</div>
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
      <div className="flex items-center gap-2 rounded-2xl bg-slate-900/[0.03] px-3 py-2.5">
        <span className="truncate font-mono text-xs text-slate-500">{url}</span>
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
              'shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset transition',
              active
                ? 'bg-money-500 text-white ring-money-500'
                : 'bg-white/60 text-slate-600 ring-slate-200 hover:bg-white',
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
    <div className="flex items-center gap-2 rounded-2xl bg-warn-50 px-3 py-2.5 text-sm font-medium text-warn-600">
      <Info className="size-4 shrink-0" />
      {text}
    </div>
  )
}

function ChannelSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="glass rounded-3xl p-5">
          <div className="flex gap-3">
            <Skeleton className="size-11 rounded-2xl" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-5 w-40" />
            </div>
          </div>
          <Skeleton className="mx-auto mt-4 size-52 rounded-3xl" />
        </div>
      ))}
    </div>
  )
}
