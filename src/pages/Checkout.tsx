import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { motion } from 'motion/react'
import { AlertTriangle, Copy, CreditCard, Link as LinkIcon, QrCode, Share2 } from 'lucide-react'
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
import { Sheet } from '../components/ui/Sheet'
import { QrCard } from '../components/QrCard'
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
      <header>
        <p className="text-sm font-medium text-slate-400">Sell &amp; get credited</p>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-slate-900">Checkout</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every link &amp; QR here is tagged to{' '}
          <span className="font-mono font-semibold text-money-600">{repCode}</span> — you get the sale.
        </p>
      </header>

      {products.loading ? (
        <ProductsSkeleton />
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
              ? 'Add a product with its Stripe Payment Link in the admin panel.'
              : "Your admin hasn't added products yet."
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
            <p className="text-center text-sm text-slate-500">
              Have the buyer scan to pay — the sale is credited to you.
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
    show(r === 'failed' ? 'Could not copy' : 'Link copied — tagged to you', r === 'failed' ? 'error' : 'success')
  }

  return (
    <motion.div variants={staggerItem}>
      <GlassCard className="overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-28 items-center justify-center bg-gradient-to-br from-money-400 to-money-600">
            <CreditCard className="size-10 text-white/80" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-xl font-bold tracking-[-0.02em] text-slate-900">{product.name}</h3>
            {product.price_display && (
              <Badge tone="money" className="shrink-0 tnum">
                {product.price_display}
              </Badge>
            )}
          </div>
          {product.description && (
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{product.description}</p>
          )}

          {url ? (
            <>
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-900/[0.03] px-3 py-2">
                <LinkIcon className="size-4 shrink-0 text-slate-400" />
                <span className="truncate font-mono text-xs text-slate-500">{url}</span>
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
    <div className="mt-4 flex items-center gap-2 rounded-2xl bg-warn-50 px-3 py-2.5 text-sm font-medium text-warn-600">
      <AlertTriangle className="size-4 shrink-0" />
      This product&apos;s Stripe link looks invalid — ask an admin to fix it.
    </div>
  )
}

function ProductsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="glass overflow-hidden rounded-3xl">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="p-5">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-4 h-11 w-full rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
