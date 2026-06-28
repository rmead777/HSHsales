import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { Megaphone, Pencil, Plus } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import { useAsync } from '../../lib/useAsync'
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAllAnnouncements,
  updateAnnouncement,
} from '../../lib/queries'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { GlassCard } from '../../components/ui/GlassCard'
import { Button } from '../../components/ui/Button'
import { Switch } from '../../components/ui/Switch'
import { Badge } from '../../components/ui/Badge'
import { Sheet } from '../../components/ui/Sheet'
import { Field, Textarea } from '../../components/ui/Field'
import { ConfirmButton } from '../../components/ui/ConfirmButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDate } from '../../lib/format'
import { staggerItem, staggerParent } from '../../lib/motion'
import type { Announcement } from '../../lib/database.types'

export function AdminAnnouncements() {
  const { show } = useToast()
  const { data, loading, reload } = useAsync(fetchAllAnnouncements, [])
  const [list, setList] = useState<Announcement[]>([])
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (data) setList(data)
  }, [data])

  async function toggleActive(a: Announcement) {
    const next = !a.active
    setList((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: next } : x)))
    try {
      await updateAnnouncement(a.id, { active: next })
    } catch {
      setList((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: a.active } : x)))
      show('Update failed', 'error')
    }
  }

  async function handleDelete(a: Announcement) {
    setEditing(null)
    setList((prev) => prev.filter((x) => x.id !== a.id))
    try {
      await deleteAnnouncement(a.id)
      show('Announcement deleted', 'info')
    } catch {
      show('Delete failed', 'error')
      void reload()
    }
  }

  return (
    <div>
      <AdminHeader
        title="Announcements"
        subtitle={loading ? 'Loading...' : `${list.length} total`}
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
          icon={Megaphone}
          title="No announcements"
          description="Post a short message and it shows at the top of every active rep's dashboard."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Post one
            </Button>
          }
        />
      ) : (
        <motion.div variants={staggerParent} initial="initial" animate="animate" className="flex flex-col gap-3">
          {list.map((a) => (
            <motion.div key={a.id} variants={staggerItem}>
              <GlassCard className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed text-white/72">{a.body}</p>
                  <Switch checked={a.active} onChange={() => toggleActive(a)} label="Visible" />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/38">{formatDate(a.created_at)}</span>
                    {a.active ? <Badge tone="money">Live</Badge> : <Badge tone="neutral">Hidden</Badge>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)} aria-label="Edit" className="px-2">
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      )}

      <AnnouncementForm
        open={creating}
        onClose={() => setCreating(false)}
        title="New announcement"
        initialBody=""
        onSubmit={async (body) => {
          const created = await createAnnouncement({ body: body.trim() })
          setList((prev) => [created, ...prev])
          setCreating(false)
          show('Announcement posted', 'success')
        }}
      />

      <AnnouncementForm
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit announcement"
        initialBody={editing?.body ?? ''}
        onSubmit={async (body) => {
          if (!editing) return
          setList((prev) => prev.map((x) => (x.id === editing.id ? { ...x, body: body.trim() } : x)))
          await updateAnnouncement(editing.id, { body: body.trim() })
          setEditing(null)
          show('Saved', 'success')
        }}
        onDelete={editing ? () => handleDelete(editing) : undefined}
      />
    </div>
  )
}

function AnnouncementForm({
  open,
  onClose,
  title,
  initialBody,
  onSubmit,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  title: string
  initialBody: string
  onSubmit: (body: string) => Promise<void>
  onDelete?: () => void
}) {
  const [body, setBody] = useState(initialBody)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setBody(initialBody)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const valid = body.trim().length > 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    try {
      await onSubmit(body)
    } catch {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Message">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="New pricing for Q3 is live - check the deck."
            required
          />
        </Field>
        <div className="mt-1 flex gap-2">
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
        <div key={i} className="glass rounded-[8px] p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
      ))}
    </div>
  )
}
