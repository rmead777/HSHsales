import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { BarChart3, Download, Plus, Wallet } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import { useAsync } from '../../lib/useAsync'
import {
  createManualSale,
  createPayout,
  deletePayout,
  deleteSale,
  fetchAllProducts,
  fetchPayouts,
  fetchProfiles,
  fetchRepEarnings,
  fetchSales,
  updateSale,
} from '../../lib/queries'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { GlassCard } from '../../components/ui/GlassCard'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { ConfirmButton } from '../../components/ui/ConfirmButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadError } from '../../components/ui/LoadError'
import { formatAmount, formatDate } from '../../lib/format'
import { parseMoneyToCents, ruleOf, saleStatusLabel, shortRule } from '../../lib/commission'
import { centsToDollars, downloadCsv, toCsv } from '../../lib/csv'
import { SALE_EVENT } from '../../lib/useSaleAlerts'
import { staggerItem, staggerParent } from '../../lib/motion'
import { cn } from '../../lib/cn'
import type { Payout, Product, Profile, RepEarnings, Sale } from '../../lib/database.types'

type Filter = 'all' | 'no-rep' | 'no-rate'

const usd = (cents: number | null | undefined) => formatAmount(cents ?? 0, 'usd')
const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

const isEarning = (s: Sale) => s.payment_status === 'paid' || s.payment_status === 'no_payment_required'

export function AdminSales() {
  const { show } = useToast()
  const sales = useAsync(fetchSales, [])
  const earnings = useAsync(fetchRepEarnings, [])
  const payouts = useAsync(fetchPayouts, [])
  const products = useAsync(fetchAllProducts, [])
  const profiles = useAsync(fetchProfiles, [])

  const [filter, setFilter] = useState<Filter>('all')
  const [openSale, setOpenSale] = useState<Sale | null>(null)
  const [payFor, setPayFor] = useState<RepEarnings | null>(null)
  const [adding, setAdding] = useState(false)

  const reloadMoney = () => {
    void sales.reload()
    void earnings.reload()
    void payouts.reload()
  }

  useEffect(() => {
    window.addEventListener(SALE_EVENT, reloadMoney)
    return () => window.removeEventListener(SALE_EVENT, reloadMoney)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const byCode = useMemo(
    () => new Map((profiles.data ?? []).map((p) => [p.rep_code, p])),
    [profiles.data],
  )
  const allSales = useMemo(() => sales.data ?? [], [sales.data])

  const needsRep = (s: Sale) => !s.rep_code || !byCode.has(s.rep_code)
  const needsRate = (s: Sale) =>
    !needsRep(s) && isEarning(s) && s.commission_type == null && s.commission_override_cents == null

  const counts = {
    noRep: allSales.filter(needsRep).length,
    noRate: allSales.filter(needsRate).length,
  }
  const shown = allSales.filter((s) =>
    filter === 'no-rep' ? needsRep(s) : filter === 'no-rate' ? needsRate(s) : true,
  )

  const revenue = allSales.filter(isEarning).reduce((t, s) => t + Math.max((s.amount ?? 0) - s.amount_refunded, 0), 0)
  const owed = (earnings.data ?? []).reduce((t, e) => t + Math.max(e.balance_cents, 0), 0)
  const paidOut = (payouts.data ?? []).reduce((t, p) => t + p.amount_cents, 0)
  const repsWithMoney = (earnings.data ?? []).filter(
    (e) => e.sales_count > 0 || e.paid_cents !== 0 || e.balance_cents !== 0 || e.waiting_count > 0,
  )

  const nameFor = (code: string | null) => {
    if (!code) return null
    const p = byCode.get(code)
    return p ? (p.full_name ?? p.email ?? code) : null
  }

  function exportSales() {
    const csv = toCsv(allSales, [
      { header: 'Date', value: (s) => s.created_at.slice(0, 10) },
      { header: 'Product', value: (s) => s.product_name },
      { header: 'Rep', value: (s) => nameFor(s.rep_code) ?? '' },
      { header: 'Rep code', value: (s) => s.rep_code },
      { header: 'Customer', value: (s) => s.customer_name },
      { header: 'Customer email', value: (s) => s.customer_email },
      { header: 'Amount paid', value: (s) => centsToDollars(s.amount) },
      { header: 'Tax', value: (s) => centsToDollars(s.amount_tax) },
      { header: 'Refunded', value: (s) => centsToDollars(s.amount_refunded) },
      { header: 'Status', value: (s) => saleStatusLabel(s).label },
      { header: 'Commission', value: (s) => centsToDollars(s.commission_cents) },
      {
        header: 'Rate',
        value: (s) => (s.commission_override_cents != null ? 'Set by hand' : shortRule(ruleOf(s))),
      },
      { header: 'Discount code', value: (s) => s.promo_code },
      { header: 'Recorded by', value: (s) => (s.source === 'manual' ? 'Added by admin' : 'Stripe') },
      { header: 'Note', value: (s) => s.note },
      { header: 'Stripe checkout', value: (s) => s.stripe_session_id },
    ])
    downloadCsv(`hsh-sales-${today()}.csv`, csv)
  }

  function exportPayouts() {
    const csv = toCsv(payouts.data ?? [], [
      { header: 'Paid on', value: (p) => p.paid_on },
      { header: 'Rep', value: (p) => nameFor(p.rep_code) ?? '' },
      { header: 'Rep code', value: (p) => p.rep_code },
      { header: 'Amount', value: (p) => centsToDollars(p.amount_cents) },
      { header: 'Note', value: (p) => p.note },
    ])
    downloadCsv(`hsh-payouts-${today()}.csv`, csv)
  }

  const loading = sales.loading && !sales.data
  const error = sales.error ?? earnings.error

  return (
    <div>
      <AdminHeader
        title="Sales and commissions"
        subtitle="Stripe sales are recorded automatically. Commission is worked out per sale."
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add sale
          </Button>
        }
      />

      {loading ? (
        <SalesSkeleton />
      ) : error ? (
        <LoadError title="Sales could not load" onRetry={reloadMoney} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Revenue" value={usd(revenue)} />
            <StatCard label="Sales" value={String(allSales.filter(isEarning).length)} />
            <StatCard label="Owed to reps" value={usd(owed)} accent />
            <StatCard label="Paid out" value={usd(paidOut)} />
          </div>

          <section>
            <SectionTitle>Owed to reps</SectionTitle>
            {repsWithMoney.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nothing owed yet"
                description="When a rep's customer pays, their commission is added here. Record each payout so balances stay right."
              />
            ) : (
              <GlassCard className="divide-y divide-white/10">
                {repsWithMoney.map((e) => (
                  <div key={e.rep_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate font-semibold text-white">{e.full_name ?? e.email ?? e.rep_code}</p>
                      <p className="truncate text-xs text-white/46 tnum">
                        <span className="font-mono">{e.rep_code}</span> · {e.sales_count}{' '}
                        {e.sales_count === 1 ? 'sale' : 'sales'} · earned {usd(e.earned_cents)} · paid{' '}
                        {usd(e.paid_cents)}
                        {e.waiting_count > 0 ? ` · ${e.waiting_count} waiting for payment` : ''}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <span
                        className={cn(
                          'font-display text-lg font-extrabold tnum',
                          e.balance_cents < 0 ? 'text-danger-300' : 'text-money-200',
                        )}
                      >
                        {usd(e.balance_cents)}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setPayFor(e)}>
                        Record payout
                      </Button>
                    </div>
                  </div>
                ))}
              </GlassCard>
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <SectionTitle className="mb-0">Sales</SectionTitle>
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                  All {allSales.length}
                </FilterChip>
                <FilterChip active={filter === 'no-rep'} onClick={() => setFilter('no-rep')} warn={counts.noRep > 0}>
                  No rep {counts.noRep}
                </FilterChip>
                <FilterChip active={filter === 'no-rate'} onClick={() => setFilter('no-rate')} warn={counts.noRate > 0}>
                  No rate {counts.noRate}
                </FilterChip>
              </div>
            </div>
            {allSales.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No sales yet"
                description="When a customer pays through a rep's link or QR code, the sale lands here with the rep's commission."
              />
            ) : shown.length === 0 ? (
              <p className="rounded-[8px] border border-white/10 px-4 py-6 text-center text-sm text-white/52">
                {filter === 'no-rep' ? 'Every sale has a rep.' : 'Every sale with a rep has a commission rate.'}
              </p>
            ) : (
              <motion.div variants={staggerParent} initial="initial" animate="animate" className="flex flex-col gap-2.5">
                {shown.map((s) => (
                  <SaleRow
                    key={s.id}
                    sale={s}
                    repName={nameFor(s.rep_code)}
                    noRep={needsRep(s)}
                    noRate={needsRate(s)}
                    onOpen={() => setOpenSale(s)}
                  />
                ))}
              </motion.div>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={exportSales} disabled={allSales.length === 0}>
              <Download className="size-4" />
              Download sales (CSV)
            </Button>
            <Button size="sm" variant="ghost" onClick={exportPayouts} disabled={(payouts.data ?? []).length === 0}>
              <Download className="size-4" />
              Download payouts (CSV)
            </Button>
          </div>
        </div>
      )}

      <PayoutSheet
        rep={payFor}
        history={(payouts.data ?? []).filter((p) => p.rep_code === payFor?.rep_code)}
        onClose={() => setPayFor(null)}
        onSaved={(message) => {
          show(message, 'success')
          reloadMoney()
        }}
        onError={() => show('Could not save the payout', 'error')}
      />

      <SaleSheet
        sale={openSale}
        products={products.data ?? []}
        profiles={profiles.data ?? []}
        onClose={() => setOpenSale(null)}
        onSaved={(message) => {
          setOpenSale(null)
          show(message, 'success')
          reloadMoney()
        }}
        onError={(message) => show(message, 'error')}
      />

      <AddSaleSheet
        open={adding}
        products={products.data ?? []}
        profiles={profiles.data ?? []}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false)
          show('Sale added', 'success')
          reloadMoney()
        }}
        onError={() => show('Could not add the sale', 'error')}
      />
    </div>
  )
}

// ─────────────────────────── rows and small parts ───────────────────────────

function SaleRow({
  sale,
  repName,
  noRep,
  noRate,
  onOpen,
}: {
  sale: Sale
  repName: string | null
  noRep: boolean
  noRate: boolean
  onOpen: () => void
}) {
  const status = saleStatusLabel(sale)
  const customer = sale.customer_name ?? sale.customer_email
  return (
    <motion.div variants={staggerItem}>
      <button onClick={onOpen} className="block w-full text-left">
        <GlassCard className="flex items-center gap-3 p-4 transition-colors hover:bg-white/[0.06]">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">{sale.product_name ?? 'Sale'}</p>
            <p className="truncate text-xs text-white/46">
              {formatDate(sale.created_at)}
              {customer ? ` · ${customer}` : ''}
              {sale.source === 'manual' ? ' · added by admin' : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {noRep ? (
                <Badge tone="warn">{sale.rep_code ? `Unknown code ${sale.rep_code}` : 'No rep'}</Badge>
              ) : (
                <Badge tone="primary">{repName ?? sale.rep_code}</Badge>
              )}
              {noRate && <Badge tone="warn">No commission rate</Badge>}
              {status.label !== 'Paid' && <Badge tone={status.tone}>{status.label}</Badge>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-bold text-white tnum">{formatAmount(sale.amount, sale.currency)}</p>
            <p className="text-xs font-semibold text-money-200 tnum">{usd(sale.commission_cents)} commission</p>
          </div>
        </GlassCard>
      </button>
    </motion.div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <GlassCard className="p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-2xl font-extrabold tracking-[-0.02em] tnum',
          accent ? 'text-money-200' : 'text-white',
        )}
      >
        {value}
      </p>
    </GlassCard>
  )
}

function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn('mb-3 font-display text-xl font-extrabold tracking-[-0.03em] text-white', className)}>
      {children}
    </h2>
  )
}

function FilterChip({
  active,
  warn,
  onClick,
  children,
}: {
  active: boolean
  warn?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-9 shrink-0 rounded-full px-3.5 text-sm font-bold tnum transition-colors',
        active
          ? 'bg-demo-400 text-[#031014]'
          : warn
            ? 'bg-warn-400/14 text-warn-100 ring-1 ring-inset ring-warn-400/26'
            : 'bg-white/[0.06] text-white/62 ring-1 ring-inset ring-white/10',
      )}
    >
      {children}
    </button>
  )
}

const selectClass =
  'h-12 w-full rounded-[8px] border border-white/12 bg-black/28 px-3 text-base text-white outline-none ' +
  'hover:border-white/20 focus-visible:border-demo-400 focus-visible:ring-4 focus-visible:ring-demo-400/15'

function RepSelect({
  value,
  onChange,
  profiles,
}: {
  value: string
  onChange: (code: string) => void
  profiles: Profile[]
}) {
  const known = profiles.some((p) => p.rep_code === value)
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="">No rep</option>
      {value && !known && <option value={value}>Unknown code {value}</option>}
      {profiles.map((p) => (
        <option key={p.id} value={p.rep_code}>
          {(p.full_name ?? p.email ?? 'Unnamed') + ` (${p.rep_code})`}
        </option>
      ))}
    </select>
  )
}

function ProductSelect({
  value,
  onChange,
  products,
}: {
  value: string
  onChange: (id: string) => void
  products: Product[]
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="">Not set</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.active ? '' : ' (hidden)'}
        </option>
      ))}
    </select>
  )
}

// ─────────────────────────── record a payout ───────────────────────────

function PayoutSheet({
  rep,
  history,
  onClose,
  onSaved,
  onError,
}: {
  rep: RepEarnings | null
  history: Payout[]
  onClose: () => void
  onSaved: (message: string) => void
  onError: () => void
}) {
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(today())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!rep) return
    setAmount(rep.balance_cents > 0 ? (rep.balance_cents / 100).toFixed(2) : '')
    setPaidOn(today())
    setNote('')
    setSaving(false)
  }, [rep])

  const cents = parseMoneyToCents(amount)
  const valid = cents != null && cents > 0 && /^\d{4}-\d{2}-\d{2}$/.test(paidOn)
  const name = rep ? (rep.full_name ?? rep.email ?? rep.rep_code) : ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!rep || !valid || cents == null) return
    setSaving(true)
    try {
      await createPayout({ rep_code: rep.rep_code, amount_cents: cents, paid_on: paidOn, note: note.trim() || null })
      onSaved(`Recorded ${usd(cents)} paid to ${name}`)
      onClose()
    } catch {
      setSaving(false)
      onError()
    }
  }

  async function remove(p: Payout) {
    try {
      await deletePayout(p.id)
      onSaved('Payout removed')
      onClose()
    } catch {
      onError()
    }
  }

  return (
    <Sheet open={!!rep} onClose={onClose} title={`Pay ${name}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm leading-6 text-white/58">
          Pay the rep however you normally do, then record it here. This app doesn't send money. Their
          balance goes down by the amount you record.
        </p>
        <div className="grid grid-cols-2 gap-3 rounded-[8px] border border-white/10 bg-black/28 p-3 text-sm">
          <span className="text-white/52">Owed now</span>
          <span className="text-right font-bold text-money-200 tnum">{usd(rep?.balance_cents)}</span>
          <span className="text-white/52">Earned so far</span>
          <span className="text-right text-white tnum">{usd(rep?.earned_cents)}</span>
          <span className="text-white/52">Paid before</span>
          <span className="text-right text-white tnum">{usd(rep?.paid_cents)}</span>
        </div>
        <Field label="Amount paid" error={amount.trim() && !valid ? 'Enter an amount above zero' : undefined}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Date paid">
          <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </Field>
        <Field label="Note (optional)" hint="How it was paid, for example check number or transfer.">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Check #1042" />
        </Field>
        <Button type="submit" fullWidth loading={saving} disabled={!valid}>
          Record payout
        </Button>
      </form>

      {history.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-white/48">Earlier payouts</p>
          <div className="divide-y divide-white/10 rounded-[8px] border border-white/10">
            {history.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{formatDate(`${p.paid_on}T12:00:00`)}</p>
                  {p.note && <p className="truncate text-xs text-white/46">{p.note}</p>}
                </div>
                <span className="font-bold text-white tnum">{usd(p.amount_cents)}</span>
                <ConfirmButton size="sm" variant="ghost" confirmLabel="Remove?" onConfirm={() => void remove(p)}>
                  Remove
                </ConfirmButton>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}

// ─────────────────────────── fix one sale ───────────────────────────

function SaleSheet({
  sale,
  products,
  profiles,
  onClose,
  onSaved,
  onError,
}: {
  sale: Sale | null
  products: Product[]
  profiles: Profile[]
  onClose: () => void
  onSaved: (message: string) => void
  onError: (message: string) => void
}) {
  const [repCode, setRepCode] = useState('')
  const [productId, setProductId] = useState('')
  const [byHand, setByHand] = useState(false)
  const [override, setOverride] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!sale) return
    setRepCode(sale.rep_code ?? '')
    setProductId(sale.product_id ?? '')
    setByHand(sale.commission_override_cents != null)
    setOverride(sale.commission_override_cents == null ? '' : (sale.commission_override_cents / 100).toFixed(2))
    setNote(sale.note ?? '')
    setSaving(false)
  }, [sale])

  const overrideCents = parseMoneyToCents(override)
  const valid = !byHand || overrideCents != null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!sale || !valid) return
    setSaving(true)
    const product = products.find((p) => p.id === productId)
    try {
      await updateSale(sale.id, {
        rep_code: repCode || null,
        product_id: productId || null,
        product_name: sale.product_name ?? product?.name ?? null,
        commission_override_cents: byHand ? overrideCents : null,
        note: note.trim() || null,
      })
      onSaved('Sale updated')
    } catch {
      setSaving(false)
      onError('Could not update the sale')
    }
  }

  async function remove() {
    if (!sale) return
    try {
      await deleteSale(sale.id)
      onSaved('Sale deleted')
    } catch {
      onError('Could not delete the sale')
    }
  }

  if (!sale) return <Sheet open={false} onClose={onClose} title="Sale" children={null} />
  const status = saleStatusLabel(sale)

  return (
    <Sheet open={!!sale} onClose={onClose} title={sale.product_name ?? 'Sale'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-[8px] border border-white/10 bg-black/28 p-3 text-sm">
          <span className="text-white/52">Customer paid</span>
          <span className="text-right font-bold text-white tnum">{formatAmount(sale.amount, sale.currency)}</span>
          {sale.amount_tax > 0 && (
            <>
              <span className="text-white/52">Of which tax</span>
              <span className="text-right text-white tnum">{formatAmount(sale.amount_tax, sale.currency)}</span>
            </>
          )}
          {sale.amount_refunded > 0 && (
            <>
              <span className="text-white/52">Refunded</span>
              <span className="text-right text-danger-300 tnum">
                {formatAmount(sale.amount_refunded, sale.currency)}
              </span>
            </>
          )}
          <span className="text-white/52">Status</span>
          <span className="text-right text-white">{status.label}</span>
          <span className="text-white/52">Commission</span>
          <span className="text-right font-bold text-money-200 tnum">
            {usd(sale.commission_cents)}
            <span className="ml-1 font-normal text-white/46">
              {sale.commission_override_cents != null ? '(set by hand)' : `(${shortRule(ruleOf(sale))})`}
            </span>
          </span>
          <span className="text-white/52">Date</span>
          <span className="text-right text-white">{formatDate(sale.created_at)}</span>
          {(sale.customer_name || sale.customer_email) && (
            <>
              <span className="text-white/52">Customer</span>
              <span className="truncate text-right text-white">
                {[sale.customer_name, sale.customer_email].filter(Boolean).join(' · ')}
              </span>
            </>
          )}
          {sale.promo_code && (
            <>
              <span className="text-white/52">Discount code</span>
              <span className="text-right font-mono text-white">{sale.promo_code}</span>
            </>
          )}
        </div>

        <Field label="Rep" hint="Who gets the commission. Changing it re-applies that rep's rate.">
          <RepSelect value={repCode} onChange={setRepCode} profiles={profiles} />
        </Field>
        <Field label="Product" hint="Sets which product's commission rate applies.">
          <ProductSelect value={productId} onChange={setProductId} products={products} />
        </Field>

        <div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-white">
            <input
              type="checkbox"
              checked={byHand}
              onChange={(e) => setByHand(e.target.checked)}
              className="size-5 accent-[var(--color-money-400,#22efb2)]"
            />
            Set this sale's commission by hand
          </label>
          {byHand && (
            <div className="mt-2">
              <Input
                value={override}
                onChange={(e) => setOverride(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                aria-label="Commission amount"
              />
              <span className="mt-2 block text-xs leading-relaxed text-white/42">
                A hand-set amount stays fixed, even if the sale is refunded later.
              </span>
            </div>
          )}
        </div>

        <Field label="Note (optional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it changed" />
        </Field>

        <div className="flex gap-2">
          {sale.source === 'manual' && (
            <ConfirmButton onConfirm={() => void remove()} className="shrink-0">
              Delete
            </ConfirmButton>
          )}
          <Button type="submit" fullWidth loading={saving} disabled={!valid}>
            Save
          </Button>
        </div>

        {sale.source === 'stripe' && (
          <details className="rounded-[8px] border border-white/10 px-3 py-2 text-xs text-white/52">
            <summary className="cursor-pointer py-1 font-semibold text-white/62">Stripe details</summary>
            <p className="mt-2 break-all font-mono">Checkout: {sale.stripe_session_id}</p>
            {sale.payment_intent && <p className="mt-1 break-all font-mono">Payment: {sale.payment_intent}</p>}
            <p className="mt-2">Stripe sales can be corrected but not deleted, so they always match Stripe.</p>
          </details>
        )}
      </form>
    </Sheet>
  )
}

// ─────────────────────────── add a sale made outside the links ───────────────────────────

function AddSaleSheet({
  open,
  products,
  profiles,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean
  products: Product[]
  profiles: Profile[]
  onClose: () => void
  onSaved: () => void
  onError: () => void
}) {
  const [repCode, setRepCode] = useState('')
  const [productId, setProductId] = useState('')
  const [amount, setAmount] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setRepCode('')
    setProductId('')
    setAmount('')
    setCustomerName('')
    setCustomerEmail('')
    setDate(today())
    setNote('')
    setSaving(false)
  }, [open])

  function pickProduct(id: string) {
    setProductId(id)
    const p = products.find((x) => x.id === id)
    if (p?.price_cents != null && !amount.trim()) setAmount((p.price_cents / 100).toFixed(2))
  }

  const cents = parseMoneyToCents(amount)
  const valid = cents != null && /^\d{4}-\d{2}-\d{2}$/.test(date)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || cents == null) return
    setSaving(true)
    const product = products.find((p) => p.id === productId)
    try {
      await createManualSale({
        rep_code: repCode || null,
        product_id: productId || null,
        product_name: product?.name ?? null,
        amount: cents,
        customer_name: customerName.trim() || null,
        customer_email: customerEmail.trim() || null,
        note: note.trim() || null,
        created_at: new Date(`${date}T12:00:00`).toISOString(),
      })
      onSaved()
    } catch {
      setSaving(false)
      onError()
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a sale">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm leading-6 text-white/58">
          For a sale that didn't go through a rep's link, such as an invoice or a purchase on the website.
          The rep earns commission on it like any other sale.
        </p>
        <Field label="Rep">
          <RepSelect value={repCode} onChange={setRepCode} profiles={profiles} />
        </Field>
        <Field label="Product">
          <ProductSelect value={productId} onChange={pickProduct} products={products} />
        </Field>
        <Field label="Amount the customer paid" error={amount.trim() && cents == null ? 'Enter an amount' : undefined}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="999.00" />
        </Field>
        <Field label="Date of sale">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Customer (optional)">
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Business name" />
        </Field>
        <Field label="Customer email (optional)">
          <Input
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            inputMode="email"
            placeholder="owner@example.com"
          />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paid by invoice #118" />
        </Field>
        <Button type="submit" fullWidth loading={saving} disabled={!valid}>
          Add sale
        </Button>
      </form>
    </Sheet>
  )
}

function SalesSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[8px]" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[8px]" />
        ))}
      </div>
    </div>
  )
}
