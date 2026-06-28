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
import { isHttpUrl } from '../../lib/validate'
import { springs, staggerItem, staggerParent } from '../../lib/motion'
import type { Product } from '../../lib/database.types'

interface FormState {
  name: string
  description: string
  image_url: string
  price_display: string
  stripe_payment_link: string
}
const EMPTY: FormState = { name: '', description: '', image_url: '', price_display: '', stripe_payment_link: '' }

export function AdminProducts() {
  const { show } = useToast()
  const { data, loading, reload } = useAsync(fetchAllProducts, [])
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
          const created = await createProduct({
            name: form.name.trim(),
            description: form.description.trim() || null,
            image_url: form.image_url.trim() || null,
            price_display: form.price_display.trim() || null,
            stripe_payment_link: form.stripe_payment_link.trim(),
            sort_order,
          })
          setList((prev) => [...prev, created])
          setCreating(false)
          show('Product added', 'success')
        }}
      />

      <ProductForm
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit product"
        initial={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? '',
                image_url: editing.image_url ?? '',
                price_display: editing.price_display ?? '',
                stripe_payment_link: editing.stripe_payment_link,
              }
            : EMPTY
        }
        onSubmit={async (form) => {
          if (!editing) return
          const patch = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            image_url: form.image_url.trim() || null,
            price_display: form.price_display.trim() || null,
            stripe_payment_link: form.stripe_payment_link.trim(),
          }
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
      <GlassCard className="flex items-center gap-3 p-3.5">
        <div className="flex flex-col">
          <button
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            aria-label="Move up"
            className="grid size-6 place-items-center rounded text-white/34 transition hover:text-demo-300 disabled:opacity-25"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            aria-label="Move down"
            className="grid size-6 place-items-center rounded text-white/34 transition hover:text-demo-300 disabled:opacity-25"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        {product.image_url ? (
          <img src={product.image_url} alt="" className="size-12 shrink-0 rounded-[8px] object-cover" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-[8px] bg-money-400/13 text-money-200 ring-1 ring-money-300/24">
            <Package className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-white">{product.name}</p>
            {product.price_display && (
              <Badge tone="money" className="shrink-0 tnum">
                {product.price_display}
              </Badge>
            )}
          </div>
          <p className="truncate font-mono text-xs text-white/42">{product.stripe_payment_link}</p>
        </div>
        <Switch checked={product.active} onChange={onToggle} label="Active" />
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit" className="px-2">
          <Pencil className="size-4" />
        </Button>
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
    if (open) setForm(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const linkOk = isHttpUrl(form.stripe_payment_link.trim())
  const imageOk = !form.image_url.trim() || isHttpUrl(form.image_url.trim())
  const valid = form.name.trim().length > 0 && linkOk && imageOk

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
            placeholder="1,000 Interactive Coasters"
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
        <Field label="Price label" hint="Display only - not what Stripe charges.">
          <Input
            value={form.price_display}
            onChange={(e) => setForm((f) => ({ ...f, price_display: e.target.value }))}
            placeholder="$1,000 (lifetime license + swag)"
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
