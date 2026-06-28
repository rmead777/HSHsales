import { useMemo } from 'react'
import { motion } from 'motion/react'
import { BarChart3, Trophy } from 'lucide-react'
import { useAsync } from '../../lib/useAsync'
import { fetchSales } from '../../lib/queries'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { GlassCard } from '../../components/ui/GlassCard'
import { Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatAmount, formatDate, sumAmounts } from '../../lib/format'
import { staggerItem, staggerParent } from '../../lib/motion'

export function AdminSales() {
  const { data, loading } = useAsync(fetchSales, [])
  const sales = useMemo(() => data ?? [], [data])
  const currency = sales[0]?.currency ?? 'usd'

  const totalRevenue = sumAmounts(
    sales.map((s) => s.amount),
    currency,
  )

  const leaderboard = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>()
    for (const s of sales) {
      const key = s.rep_code ?? '—'
      const cur = map.get(key) ?? { count: 0, amount: 0 }
      cur.count += 1
      cur.amount += s.amount ?? 0
      map.set(key, cur)
    }
    return [...map.entries()]
      .map(([rep, v]) => ({ rep, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [sales])

  return (
    <div>
      <AdminHeader title="Sales" subtitle="Captured automatically by the Stripe webhook." />

      {loading ? (
        <SalesSkeleton />
      ) : sales.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No sales captured yet"
          description="When a buyer completes checkout, the Stripe webhook records the sale here — tagged to the rep."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total sales" value={String(sales.length)} />
            <StatCard label="Revenue" value={totalRevenue} accent />
          </div>

          {leaderboard.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold tracking-[-0.01em] text-slate-800">
                <Trophy className="size-[1.1rem] text-warn-500" />
                Top reps
              </h2>
              <GlassCard className="divide-y divide-slate-900/5">
                {leaderboard.map((r, i) => (
                  <div key={r.rep} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-7 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 tnum">
                      {i + 1}
                    </span>
                    <span className="flex-1 font-mono text-sm font-semibold text-slate-700">{r.rep}</span>
                    <span className="text-xs text-slate-400 tnum">{r.count} sales</span>
                    <span className="w-24 text-right font-semibold text-money-600 tnum">
                      {formatAmount(r.amount, currency)}
                    </span>
                  </div>
                ))}
              </GlassCard>
            </section>
          )}

          <section>
            <h2 className="mb-3 font-display text-lg font-bold tracking-[-0.01em] text-slate-800">Recent</h2>
            <motion.div variants={staggerParent} initial="initial" animate="animate" className="flex flex-col gap-3">
              {sales.map((s) => (
                <motion.div key={s.id} variants={staggerItem}>
                  <GlassCard className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-800">{s.product_name ?? 'Sale'}</p>
                      <p className="truncate text-xs text-slate-400">
                        {formatDate(s.created_at)}
                        {s.customer_email ? ` · ${s.customer_email}` : ''}
                      </p>
                    </div>
                    {s.rep_code ? (
                      <Badge tone="primary" className="font-mono">
                        {s.rep_code}
                      </Badge>
                    ) : (
                      <Badge tone="warn">unattributed</Badge>
                    )}
                    <span className="w-20 shrink-0 text-right font-bold text-slate-900 tnum">
                      {formatAmount(s.amount, s.currency)}
                    </span>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </section>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <GlassCard className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-extrabold tracking-[-0.02em] tnum ${
          accent ? 'text-money-600' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </GlassCard>
  )
}

function SalesSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-20 rounded-3xl" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-3xl" />
        ))}
      </div>
    </div>
  )
}
