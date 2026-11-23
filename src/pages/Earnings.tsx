import { useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import { Banknote, Receipt } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../lib/useAsync'
import { fetchMyEarnings, fetchMyPayouts, fetchMySales } from '../lib/queries'
import { formatAmount, formatDate } from '../lib/format'
import { isThisMonth, saleStatusLabel } from '../lib/commission'
import { SALE_EVENT } from '../lib/useSaleAlerts'
import { GlassCard } from '../components/ui/GlassCard'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadError } from '../components/ui/LoadError'
import { springs, staggerItem, staggerParent } from '../lib/motion'
import type { Payout, Sale } from '../lib/database.types'

export function Earnings() {
  const { profile } = useAuth()
  const profileId = profile?.id ?? ''
  const repCode = profile?.rep_code ?? ''

  const earnings = useAsync(() => (profileId ? fetchMyEarnings(profileId) : Promise.resolve(null)), [profileId])
  const sales = useAsync(() => (repCode ? fetchMySales(repCode) : Promise.resolve([] as Sale[])), [repCode])
  const payouts = useAsync(() => (repCode ? fetchMyPayouts(repCode) : Promise.resolve([] as Payout[])), [repCode])

  // A new sale arriving live refreshes the page.
  useEffect(() => {
    const reload = () => {
      void earnings.reload()
      void sales.reload()
    }
    window.addEventListener(SALE_EVENT, reload)
    return () => window.removeEventListener(SALE_EVENT, reload)
  }, [earnings, sales])

  const monthCents = useMemo(
    () => (sales.data ?? []).filter((s) => isThisMonth(s.created_at)).reduce((sum, s) => sum + s.commission_cents, 0),
    [sales.data],
  )

  const e = earnings.data
  const balance = e?.balance_cents ?? 0

  return (
    <div className="flex flex-col gap-6">
      {earnings.loading && !e ? (
        <Skeleton className="h-48 rounded-[8px]" />
      ) : earnings.error ? (
        <LoadError title="Your earnings could not load" onRetry={earnings.reload} />
      ) : (
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: springs.standardExpressive }}
          className="glass-strong relative overflow-hidden rounded-[8px] p-5"
        >
          <div className="pointer-events-none absolute -right-14 -top-16 size-44 rounded-full bg-money-400/16 blur-3xl" />
          <p className="relative text-xs font-black uppercase tracking-[0.22em] text-money-300">
            {balance < 0 ? 'Balance' : 'Owed to you'}
          </p>
          <p className="relative mt-2 font-display text-5xl font-extrabold leading-none tracking-[-0.05em] text-white tnum">
            {formatAmount(balance, 'usd')}
          </p>
          {balance < 0 && (
            <p className="relative mt-2 text-sm leading-6 text-white/58">
              A refund came in after you were paid. It comes off your next payout.
            </p>
          )}
          <div className="relative mt-5 grid grid-cols-3 gap-2">
            <Metric label="Earned" value={formatAmount(e?.earned_cents ?? 0, 'usd')} />
            <Metric label="Paid to you" value={formatAmount(e?.paid_cents ?? 0, 'usd')} />
            <Metric label="This month" value={formatAmount(monthCents, 'usd')} />
          </div>
          {(e?.waiting_count ?? 0) > 0 && (
            <p className="relative mt-4 text-sm font-semibold text-warn-100">
              {e!.waiting_count === 1
                ? "1 sale is waiting for the customer's bank payment to clear."
                : `${e!.waiting_count} sales are waiting for the customer's bank payment to clear.`}
            </p>
          )}
        </motion.header>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl font-extrabold tracking-[-0.03em] text-white">Your sales</h2>
        {sales.loading && !sales.data ? (
          <RowsSkeleton />
        ) : sales.error ? (
          <LoadError title="Sales could not load" onRetry={sales.reload} />
        ) : (sales.data ?? []).length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No sales yet"
            description="When a customer pays through your link or QR code, the sale and your commission show up here within a minute."
          />
        ) : (
          <motion.div variants={staggerParent} initial="initial" animate="animate" className="flex flex-col gap-2.5">
            {(sales.data ?? []).map((s) => (
              <SaleRow key={s.id} sale={s} />
            ))}
          </motion.div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-extrabold tracking-[-0.03em] text-white">Payouts</h2>
        {payouts.loading && !payouts.data ? (
          <RowsSkeleton count={2} />
        ) : payouts.error ? (
          <LoadError title="Payouts could not load" onRetry={payouts.reload} />
        ) : (payouts.data ?? []).length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No payouts yet"
            description="Each time you're paid, the date and amount are listed here."
          />
        ) : (
          <GlassCard className="divide-y divide-white/10">
            {(payouts.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{formatDate(`${p.paid_on}T12:00:00`)}</p>
                  {p.note && <p className="truncate text-xs text-white/46">{p.note}</p>}
                </div>
                <span className="font-bold text-money-200 tnum">{formatAmount(p.amount_cents, 'usd')}</span>
              </div>
            ))}
          </GlassCard>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between rounded-[8px] border border-white/10 bg-black/28 px-3 py-3">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-white tnum">{value}</p>
    </div>
  )
}

function SaleRow({ sale }: { sale: Sale }) {
  const status = saleStatusLabel(sale)
  const who = sale.customer_name ?? sale.customer_email
  return (
    <motion.div variants={staggerItem}>
      <GlassCard className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{sale.product_name ?? 'Sale'}</p>
          <p className="truncate text-xs text-white/46">
            {formatDate(sale.created_at)}
            {who ? ` · ${who}` : ''}
          </p>
          {status.label !== 'Paid' && (
            <Badge tone={status.tone} className="mt-2">
              {status.label}
            </Badge>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-extrabold text-money-200 tnum">
            {formatAmount(sale.commission_cents, 'usd')}
          </p>
          <p className="text-xs text-white/42 tnum">of {formatAmount(sale.amount, sale.currency)}</p>
        </div>
      </GlassCard>
    </motion.div>
  )
}

function RowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] rounded-[8px]" />
      ))}
    </div>
  )
}
