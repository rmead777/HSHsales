import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { ChevronDown, ChevronUp, Package, Pencil, Plus } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import { useAsync } from '../../lib/useAsync'
import { createProduct, deleteProduct, fetchAllProducts, updateProduct } from '../../lib/queries'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { GlassCard } from '../../components/ui/GlassCard'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Switch } from '../../components/ui/Switch'
import { Sheet } from '../../components/ui/Sheet'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { ConfirmButton } from '../../components/ui/ConfirmButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadError } from '../../components/ui/LoadError'
import { isHttpUrl } from '../../lib/validate'
import { parseMoneyToCents, parseRuleValue, ruleOf, shortRule } from '../../lib/commission'
import { cn } from '../../lib/cn'
import { springs, staggerItem, staggerParent } from '../../lib/motion'
import type { CommissionType, Product } from '../../lib/database.types'

interface FormState {
  name: string
  description: string
  image_url: string
  price_display: string
  stripe_payment_link: string
  price: string
  commission_type: CommissionType
  commission_value: string
  promo_code: string
}
const EMPTY: FormState = {
  name: '',
  description: '',
  image_url: '',
  price_display: '',
  stripe_payment_link: '',
  price: '',
  commission_type: 'percent',
  commission_value: '',
  promo_code: '',
}

function toForm(p: Product): FormState {
  return {
    name: p.name,
    description: p.description ?? '',
    image_url: p.image_url ?? '',
    price_display: p.price_display ?? '',
    stripe_payment_link: p.stripe_payment_link,
    price: p.price_cents == null ? '' : (p.price_cents / 100).toFixed(2).replace(/\.00$/, ''),
    commission_type: p.commission_type ?? 'percent',
    commission_value: p.commission_value == null ? '' : String(p.commission_value),
    promo_code: p.promo_code ?? '',
  }
}

/** Form -> product columns. A blank commission means none is set. */
function fromForm(form: FormState) {
  const value = form.commission_value.trim() ? parseRuleValue(form.commission_value) : null
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    image_url: form.image_url.trim() || null,
    price_display: form.price_display.trim() || null,
    stripe_payment_link: form.stripe_payment_link.trim(),
    price_cents: form.price.trim() ? parseMoneyToCents(form.price) : null,
    commission_type: value == null ? null : form.commission_type,
    commission_value: value,
    promo_code: form.promo_code.trim() || null,
  }
}

export function AdminProducts() {
  const { show } = useToast()
  const { data, loading, error, reload } = useAsync(fetchAllProducts, [])
  const [list, setList] = useState<Product[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (data) setList(data)
  }, [data])

  async function toggleActive(p: Product) {
    const next = !p.active
    setList((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: next } : x)))
    try {
      await updateProduct(p.id, { active: next })
    } catch {
      setList((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: p.active } : x)))
      show('Update failed', 'error')
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= list.length) return
    const a = list[index]
    const b = list[target]
    const next = [...list]
    next[index] = { ...a, sort_order: b.sort_order }
    next[target] = { ...b, sort_order: a.sort_order }
    next.sort((x, y) => x.sort_order - y.sort_order)
    setList(next)
    try {
      await Promise.all([
        updateProduct(a.id, { sort_order: b.sort_order }),
        updateProduct(b.id, { sort_order: a.sort_order }),
      ])
    } catch {
      show('Reorder failed', 'error')
      void reload()
    }
  }

  async function handleDelete(p: Product) {
    setEditing(null)
    setList((prev) => prev.filter((x) => x.id !== p.id))
    try {
      await deleteProduct(p.id)
      show('Product deleted', 'info')
    } catch {
      show('Delete failed', 'error')
      void reload()
    }
  }

  return (
    <div>
      <AdminHeader
        title="Products"
        subtitle={loading ? 'Loading...' : `${list.length} ${list.length === 1 ? 'product' : 'products'}`}
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Add
          </Button>
        }
      />

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <LoadError title="Products unavailable" onRetry={reload} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add a product and paste its Stripe Payment Link - reps get an attributed checkout instantly."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Add product
            </Button>
          }
        />
      ) : (
        <motion.div variants={staggerParent} initial="initial" animate="animate" className="flex flex-col gap-3">
          {list.map((p, i) => (
            <ProductRowCard
              key={p.id}
              product={p}
              index={i}
              total={list.length}
              onMove={move}
              onToggle={() => toggleActive(p)}
              onEdit={() => setEditing(p)}
            />
          ))}
        </motion.div>
      )}

      <ProductForm
        open={creating}
        onClose={() => setCreating(false)}
        title="Add product"
        initial={EMPTY}
        onSubmit={async (form) => {
          const sort_order = (list.at(-1)?.sort_order ?? 0) + 1
          const created = await createProduct({ ...fromForm(form), sort_order })
          setList((prev) => [...prev, created])
          setCreating(false)
          show('Product added', 'success')
        }}
      />

      <ProductForm
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit product"
        initial={editing ? toForm(editing) : EMPTY}
        onSubmit={async (form) => {
          if (!editing) return
          const patch = fromForm(form)
          setList((prev) => prev.map((x) => (x.id === editing.id ? { ...x, ...patch } : x)))
          await updateProduct(editing.id, patch)
          setEditing(null)
          show('Saved', 'success')
        }}
        onDelete={editing ? () => handleDelete(editing) : undefined}
      />
    </div>
  )
}

function ProductRowCard({
  product,
  index,
  total,
  onMove,
  onToggle,
  onEdit,
}: {
  product: Product
  index: number
  total: number
  onMove: (index: number, dir: -1 | 1) => void
  onToggle: () => void
  onEdit: () => void
}) {
  return (
    <motion.div variants={staggerItem} layout transition={springs.standardFunctional}>
      <GlassCard className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 p-3.5 sm:flex sm:items-center sm:gap-3">
        <div className="row-span-2 flex flex-col gap-1 sm:row-auto">
          <button
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            aria-label="Move up"
            className="grid size-9 place-items-center rounded text-white/34 transition hover:bg-white/[0.08] hover:text-demo-300 disabled:opacity-25"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            aria-label="Move down"
            className="grid size-9 place-items-center rounded text-white/34 transition hover:bg-white/[0.08] hover:text-demo-300 disabled:opacity-25"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <div className="grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 sm:flex sm:flex-1">
          {product.image_url ? (
            <img src={product.image_url} alt="" className="size-12 shrink-0 rounded-[8px] object-cover" />
          ) : (
            <span className="grid size-12 shrink-0 place-items-center rounded-[8px] bg-money-400/13 text-money-200 ring-1 ring-money-300/24">
              <Package className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="min-w-0 max-w-full truncate font-semibold text-white">{product.name}</p>
              {product.price_display && (
                <Badge tone="money" className="max-w-full min-w-0 truncate tnum sm:max-w-56">
                  {product.price_display}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-white/42">{product.stripe_payment_link}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ruleOf(product) ? (
                <Badge tone="money">Commission {shortRule(ruleOf(product))}</Badge>
              ) : (
                <Badge tone="warn">No commission set</Badge>
              )}
              {product.promo_code && <Badge tone="demo">Code {product.promo_code}</Badge>}
            </div>
          </div>
        </div>
        <div className="col-start-2 flex min-w-0 items-center justify-between gap-2 border-t border-white/10 pt-3 sm:col-auto sm:ml-auto sm:border-0 sm:pt-0">
          <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/34 sm:hidden">
            Active
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Switch checked={product.active} onChange={onToggle} label="Active" />
            <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit" className="px-2">
              <Pencil className="size-4" />
            </Button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

function ProductForm({
  open,
  onClose,
  title,
  initial,
  onSubmit,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  title: string
  initial: FormState
  onSubmit: (form: FormState) => Promise<void>
  onDelete?: () => void
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial)
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const linkOk = isHttpUrl(form.stripe_payment_link.trim())
  const imageOk = !form.image_url.trim() || isHttpUrl(form.image_url.trim())
  const priceOk = !form.price.trim() || parseMoneyToCents(form.price) != null
  const ruleValue = form.commission_value.trim() ? parseRuleValue(form.commission_value) : null
  const ruleOk =
    !form.commission_value.trim() ||
    (ruleValue != null && (form.commission_type === 'flat' || ruleValue <= 100))
  const promoOk = !form.promo_code.trim() || /^[A-Za-z0-9_-]+$/.test(form.promo_code.trim())
  const valid = form.name.trim().length > 0 && linkOk && imageOk && priceOk && ruleOk && promoOk

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    try {
      await onSubmit(form)
    } catch {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="High Score Host Launch Kit"
            required
          />
        </Field>
        <Field
          label="Stripe Payment Link"
          hint="The base link - the rep's code is appended automatically at checkout."
          error={form.stripe_payment_link.trim() && !linkOk ? 'Enter a full URL including https://' : undefined}
        >
          <Input
            value={form.stripe_payment_link}
            onChange={(e) => setForm((f) => ({ ...f, stripe_payment_link: e.target.value }))}
            placeholder="https://buy.stripe.com/..."
            inputMode="url"
            required
          />
        </Field>
        <Field
          label="Price Stripe charges"
          hint="In dollars. Used to show reps what they earn per sale."
          error={!priceOk ? 'Enter an amount like 999 or 999.00' : undefined}
        >
          <Input
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            placeholder="999"
            inputMode="decimal"
          />
        </Field>
        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-white/48">Commission</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Commission type">
            {(
              [
                ['percent', '% of each sale'],
                ['flat', '$ per sale'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.commission_type === value}
                onClick={() => setForm((f) => ({ ...f, commission_type: value }))}
                className={cn(
                  'h-11 rounded-[8px] border text-sm font-bold transition-colors',
                  form.commission_type === value
                    ? 'border-money-300/40 bg-money-400/16 text-money-100'
                    : 'border-white/12 bg-black/28 text-white/56 hover:border-white/24',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <Input
              value={form.commission_value}
              onChange={(e) => setForm((f) => ({ ...f, commission_value: e.target.value }))}
              placeholder={form.commission_type === 'percent' ? '10' : '100'}
              inputMode="decimal"
              aria-label={form.commission_type === 'percent' ? 'Commission percent' : 'Commission dollars per sale'}
            />
          </div>
          <span
            className={cn(
              'mt-2 block text-xs leading-relaxed',
              ruleOk ? 'text-white/42' : 'font-semibold text-danger-400',
            )}
          >
            {!ruleOk
              ? form.commission_type === 'percent'
                ? 'Enter a percent from 0 to 100'
                : 'Enter a dollar amount'
              : form.commission_type === 'percent'
                ? 'Percent of what the customer pays, before tax. Leave blank for no commission. A rep with their own rate (Reps tab) gets that instead.'
                : 'Dollars per sale. Leave blank for no commission. A rep with their own rate (Reps tab) gets that instead.'}
          </span>
        </div>
        <Field
          label="Discount code (optional)"
          hint="A Stripe promotion code filled in for the buyer on every rep link. Create it in Stripe first, and allow promotion codes on the Payment Link."
          error={!promoOk ? 'Letters, numbers, dashes and underscores only' : undefined}
        >
          <Input
            value={form.promo_code}
            onChange={(e) => setForm((f) => ({ ...f, promo_code: e.target.value }))}
            placeholder="LAUNCH20"
            autoCapitalize="characters"
          />
        </Field>
        <Field label="Price label" hint='What reps and buyers see, like "$999 (lifetime license)".'>
          <Input
            value={form.price_display}
            onChange={(e) => setForm((f) => ({ ...f, price_display: e.target.value }))}
            placeholder="$999 (lifetime license + marketing materials)"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What the buyer gets..."
          />
        </Field>
        <Field
          label="Image URL (optional)"
          error={!imageOk ? 'Enter a full URL including https://' : undefined}
        >
          <Input
            value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            placeholder="https://.../photo.jpg"
            inputMode="url"
          />
        </Field>
        <div className="mt-2 flex gap-2">
          {onDelete && (
            <ConfirmButton onConfirm={onDelete} className="shrink-0">
              Delete
            </ConfirmButton>
          )}
          <Button type="submit" fullWidth loading={saving} disabled={!valid}>
            Save
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass flex items-center gap-3 rounded-[8px] p-3.5">
          <Skeleton className="size-12 rounded-[8px]" />
          <div className="flex-1">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-2 h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
