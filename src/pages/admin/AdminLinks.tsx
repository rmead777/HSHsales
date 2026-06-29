import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { ChevronDown, ChevronUp, Link as LinkIcon, Pencil, Plus } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import { useAsync } from '../../lib/useAsync'
import { createLink, deleteLink, fetchAllLinks, updateLink } from '../../lib/queries'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { GlassCard } from '../../components/ui/GlassCard'
import { Button } from '../../components/ui/Button'
import { Switch } from '../../components/ui/Switch'
import { Sheet } from '../../components/ui/Sheet'
import { Field, Input } from '../../components/ui/Field'
import { ConfirmButton } from '../../components/ui/ConfirmButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadError } from '../../components/ui/LoadError'
import { resolveLinkIcon } from '../../lib/linkIcon'
import { isHttpUrl } from '../../lib/validate'
import { springs, staggerItem, staggerParent } from '../../lib/motion'
import type { Link as LinkRow } from '../../lib/database.types'

interface FormState {
  label: string
  url: string
  icon: string
}
const EMPTY: FormState = { label: '', url: '', icon: '' }

export function AdminLinks() {
  const { show } = useToast()
  const { data, loading, error, reload } = useAsync(fetchAllLinks, [])
  const [list, setList] = useState<LinkRow[]>([])
  const [editing, setEditing] = useState<LinkRow | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (data) setList(data)
  }, [data])

  async function toggleActive(l: LinkRow) {
    const next = !l.active
    setList((prev) => prev.map((x) => (x.id === l.id ? { ...x, active: next } : x)))
    try {
      await updateLink(l.id, { active: next })
    } catch {
      setList((prev) => prev.map((x) => (x.id === l.id ? { ...x, active: l.active } : x)))
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
        updateLink(a.id, { sort_order: b.sort_order }),
        updateLink(b.id, { sort_order: a.sort_order }),
      ])
    } catch {
      show('Reorder failed', 'error')
      void reload()
    }
  }

  async function handleDelete(l: LinkRow) {
    setEditing(null)
    setList((prev) => prev.filter((x) => x.id !== l.id))
    try {
      await deleteLink(l.id)
      show('Link deleted', 'info')
    } catch {
      show('Delete failed', 'error')
      void reload()
    }
  }

  return (
    <div>
      <AdminHeader
        title="Links"
        subtitle={loading ? 'Loading...' : `${list.length} ${list.length === 1 ? 'link' : 'links'}`}
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
        <LoadError title="Links unavailable" onRetry={reload} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={LinkIcon}
          title="No links yet"
          description="Add a button that links out to a deck, pricing sheet, video, or training doc."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Add link
            </Button>
          }
        />
      ) : (
        <motion.div variants={staggerParent} initial="initial" animate="animate" className="flex flex-col gap-3">
          {list.map((l, i) => (
            <LinkRowCard
              key={l.id}
              link={l}
              index={i}
              total={list.length}
              onMove={move}
              onToggle={() => toggleActive(l)}
              onEdit={() => setEditing(l)}
            />
          ))}
        </motion.div>
      )}

      <LinkForm
        open={creating}
        onClose={() => setCreating(false)}
        title="Add link"
        initial={EMPTY}
        onSubmit={async (form) => {
          const sort_order = (list.at(-1)?.sort_order ?? 0) + 1
          const created = await createLink({
            label: form.label.trim(),
            url: form.url.trim(),
            icon: form.icon.trim() || null,
            sort_order,
          })
          setList((prev) => [...prev, created])
          setCreating(false)
          show('Link added', 'success')
        }}
      />

      <LinkForm
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit link"
        initial={editing ? { label: editing.label, url: editing.url, icon: editing.icon ?? '' } : EMPTY}
        onSubmit={async (form) => {
          if (!editing) return
          const patch = { label: form.label.trim(), url: form.url.trim(), icon: form.icon.trim() || null }
          setList((prev) => prev.map((x) => (x.id === editing.id ? { ...x, ...patch } : x)))
          await updateLink(editing.id, patch)
          setEditing(null)
          show('Saved', 'success')
        }}
        onDelete={editing ? () => handleDelete(editing) : undefined}
      />
    </div>
  )
}

function LinkRowCard({
  link,
  index,
  total,
  onMove,
  onToggle,
  onEdit,
}: {
  link: LinkRow
  index: number
  total: number
  onMove: (index: number, dir: -1 | 1) => void
  onToggle: () => void
  onEdit: () => void
}) {
  const Icon = resolveLinkIcon(link.icon ?? link.label)
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
        <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-demo-400/13 text-demo-300 ring-1 ring-demo-300/24">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{link.label}</p>
          <p className="truncate text-xs text-white/42">{link.url}</p>
        </div>
        <Switch checked={link.active} onChange={onToggle} label="Active" />
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit" className="px-2">
          <Pencil className="size-4" />
        </Button>
      </GlassCard>
    </motion.div>
  )
}

function LinkForm({
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

  // Reseed when the sheet opens (initial changes identity across edits).
  useEffect(() => {
    if (open) {
      setForm(initial)
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const urlOk = isHttpUrl(form.url.trim())
  const valid = form.label.trim().length > 0 && urlOk

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
        <Field label="Label">
          <Input
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Sales Deck"
            required
          />
        </Field>
        <Field
          label="Destination URL"
          hint="Opens in a new tab. Paste a Google Doc/Slides/Sheet, YouTube, or hosted page."
          error={form.url.trim() && !urlOk ? 'Enter a full URL including https://' : undefined}
        >
          <Input
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://docs.google.com/..."
            inputMode="url"
            required
          />
        </Field>
        <Field label="Icon (optional)" hint="Keyword: deck, pricing, video, training, help, info...">
          <Input
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            placeholder="deck"
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
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass flex items-center gap-3 rounded-[8px] p-3.5">
          <Skeleton className="size-10 rounded-[8px]" />
          <div className="flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
