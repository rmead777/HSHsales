import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { motion } from 'motion/react'
import { AlertTriangle, Copy, CreditCard, Link as LinkIcon, QrCode, Share2, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { useAsync } from '../lib/useAsync'
import { fetchActiveProducts } from '../lib/queries'
import { safeBuildAttributedPaymentLink } from '../lib/attribution'
import { copyText, shareOrCopy } from '../lib/share'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadError } from '../components/ui/LoadError'
import { Sheet } from '../components/ui/Sheet'
import { QrCard } from '../components/QrCard'
import { BrandMark } from '../components/BrandMark'
import { staggerItem, staggerParent } from '../lib/motion'
import type { Product } from '../lib/database.types'

function slug(s: string | undefined): string {
  return (s ?? 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function Checkout() {
  const { profile, isAdmin } = useAuth()
  const products = useAsync(fetchActiveProducts, [])
  const repCode = profile?.rep_code ?? ''
  const [qrProduct, setQrProduct] = useState<Product | null>(null)

  const qrUrl = qrProduct ? safeBuildAttributedPaymentLink(qrProduct.stripe_payment_link, repCode) : null

  return (
    <div className="flex flex-col gap-6">
      <header className="glass-strong scanline-mask relative overflow-hidden rounded-[8px] p-5">
        <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-money-400/16 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-money-300">Sell and get credited</p>
            <h1 className="mt-2 font-display text-4xl font-extrabold leading-none tracking-[-0.05em] text-chrome">
              Checkout
            </h1>
          </div>
          <BrandMark className="size-14 shrink-0" />
        </div>
        <p className="relative mt-4 max-w-md text-sm leading-6 text-white/58">
          Every link and QR on this screen is stamped with{' '}
          <span className="font-mono font-bold text-money-200 tnum">{repCode || 'your rep code'}</span>.
          That is the quiet little machine making attribution behave.
        </p>
      </header>

      {products.loading ? (
        <ProductsSkeleton />
      ) : products.error ? (
        <LoadError title="Products unavailable" onRetry={products.reload} />
      ) : products.data && products.data.length > 0 ? (
        <motion.div
          variants={staggerParent}
          initial="initial"
          animate="animate"
          className="flex flex-col gap-4"
        >
          {products.data.map((p) => (
            <ProductCard key={p.id} product={p} repCode={repCode} onShowQr={() => setQrProduct(p)} />
          ))}
        </motion.div>
      ) : (
        <EmptyState
          icon={CreditCard}
          title="No products yet"
          description={
            isAdmin
              ? 'Add a product with its Stripe Payment Link and reps can sell it immediately.'
              : "Your admin has not added products yet."
          }
          action={
            isAdmin ? (
              <RouterLink to="/admin/products">
                <Button size="sm">Manage products</Button>
              </RouterLink>
            ) : undefined
          }
        />
      )}

      <Sheet open={!!qrProduct} onClose={() => setQrProduct(null)} title={qrProduct?.name ?? 'QR code'}>
        {qrUrl ? (
          <div className="flex flex-col items-center gap-4">
            <p className="max-w-sm text-center text-sm leading-6 text-white/56">
              Have the buyer scan to pay. The completed checkout reports back with your rep code.
            </p>
            <QrCard url={qrUrl} fileName={`${slug(qrProduct?.name)}-${repCode}`} />
            <LinkActions url={qrUrl} title={qrProduct?.name} />
          </div>
        ) : (
          <MalformedLink />
        )}
      </Sheet>
    </div>
  )
}

function ProductCard({
  product,
  repCode,
  onShowQr,
}: {
  product: Product
  repCode: string
  onShowQr: () => void
}) {
  const { show } = useToast()
  const url = safeBuildAttributedPaymentLink(product.stripe_payment_link, repCode)

  async function onCopy() {
    if (!url) return
    const r = await copyText(url)
    show(r === 'failed' ? 'Could not copy' : 'Link copied - tagged to you', r === 'failed' ? 'error' : 'success')
  }

  return (
    <motion.div variants={staggerItem}>
      <GlassCard className="overflow-hidden">
        <div className="relative">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} loading="lazy" className="h-40 w-full object-cover" />
          ) : (
            <div className="scanline-mask flex h-32 items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,239,178,0.32),transparent_42%),linear-gradient(135deg,rgba(0,0,0,0.18),rgba(0,201,139,0.24))]">
              <CreditCard className="size-11 text-money-200" />
            </div>
          )}
          <div className="absolute left-4 top-4">
            <Badge tone="money">
              <Zap className="size-3" /> Attributed
            </Badge>
          </div>
        </div>
        <div className="relative p-5">
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
            <h3 className="min-w-0 font-display text-2xl font-extrabold leading-tight tracking-[-0.04em] text-white">
              {product.name}
            </h3>
            {product.price_display && (
              <Badge tone="money" className="max-w-full min-w-0 whitespace-normal text-left leading-snug tnum sm:max-w-[56%] sm:shrink-0">
                <span className="min-w-0 break-words">{product.price_display}</span>
              </Badge>
            )}
          </div>
          {product.description && (
            <p className="mt-2 text-sm leading-relaxed text-white/56">{product.description}</p>
          )}

          {url ? (
            <>
              <div className="mt-4 flex items-center gap-2 rounded-[8px] border border-white/10 bg-black/28 px-3 py-2">
                <LinkIcon className="size-4 shrink-0 text-demo-300" />
                <span className="truncate font-mono text-xs text-white/48">{url}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button variant="money" onClick={onCopy}>
                  <Copy className="size-4" />
                  Copy
                </Button>
                <Button variant="outline" onClick={() => void shareProduct(product, url, show)}>
                  <Share2 className="size-4" />
                  Share
                </Button>
                <Button variant="outline" onClick={onShowQr}>
                  <QrCode className="size-4" />
                  QR
                </Button>
              </div>
            </>
          ) : (
            <MalformedLink />
          )}
        </div>
      </GlassCard>
    </motion.div>
  )
}

async function shareProduct(
  product: Product,
  url: string,
  show: (m: string, t?: 'success' | 'info' | 'error') => void,
) {
  const r = await shareOrCopy({ title: product.name, text: `Check out ${product.name}`, url })
  show(
    r === 'failed' ? 'Could not share' : r === 'shared' ? 'Shared' : 'Link copied',
    r === 'failed' ? 'error' : 'success',
  )
}

function LinkActions({ url, title }: { url: string; title?: string }) {
  const { show } = useToast()
  return (
    <div className="grid w-full grid-cols-2 gap-2">
      <Button
        variant="money"
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

function MalformedLink() {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-[8px] border border-warn-400/24 bg-warn-400/12 px-3 py-2.5 text-sm font-semibold text-warn-100">
      <AlertTriangle className="size-4 shrink-0" />
      This product's Stripe link looks invalid. Ask an admin to fix it.
    </div>
  )
}

function ProductsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="glass overflow-hidden rounded-[8px]">
          <Skeleton className="h-32 w-full rounded-none" />
          <div className="p-5">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-4 h-11 w-full rounded-[8px]" />
          </div>
        </div>
      ))}
    </div>
  )
}
