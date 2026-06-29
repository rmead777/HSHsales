import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { useAsync } from '../../lib/useAsync'
import { fetchProfiles, setProfileActive, setProfileRole } from '../../lib/queries'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { GlassCard } from '../../components/ui/GlassCard'
import { Switch } from '../../components/ui/Switch'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadError } from '../../components/ui/LoadError'
import { formatDate } from '../../lib/format'
import { staggerItem, staggerParent } from '../../lib/motion'
import { cn } from '../../lib/cn'
import type { Profile, Role } from '../../lib/database.types'

export function AdminReps() {
  const { user } = useAuth()
  const { show } = useToast()
  const { data, loading, error, reload } = useAsync(fetchProfiles, [])
  const [list, setList] = useState<Profile[]>([])
  const [mutating, setMutating] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (data) setList(data)
  }, [data])

  function lock(id: string) {
    setMutating((prev) => new Set(prev).add(id))
  }
  function unlock(id: string) {
    setMutating((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  async function toggleActive(p: Profile) {
    if (mutating.has(p.id)) return // one mutation per rep at a time
    lock(p.id)
    const next = !p.active
    setList((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: next } : x)))
    try {
      await setProfileActive(p.id, next)
      show(next ? `Activated ${displayName(p)}` : `Deactivated ${displayName(p)}`, next ? 'success' : 'info')
    } catch {
      setList((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: p.active } : x)))
      show('Update failed', 'error')
      void reload()
    } finally {
      unlock(p.id)
    }
  }

  async function toggleRole(p: Profile) {
    if (mutating.has(p.id)) return
    lock(p.id)
    const next: Role = p.role === 'admin' ? 'rep' : 'admin'
    setList((prev) => prev.map((x) => (x.id === p.id ? { ...x, role: next } : x)))
    try {
      await setProfileRole(p.id, next)
      show(`${displayName(p)} is now ${next === 'admin' ? 'an admin' : 'a rep'}`, 'success')
    } catch {
      setList((prev) => prev.map((x) => (x.id === p.id ? { ...x, role: p.role } : x)))
      show('Update failed', 'error')
      void reload()
    } finally {
      unlock(p.id)
    }
  }

  const pendingCount = list.filter((p) => !p.active).length

  return (
    <div>
      <AdminHeader
        title="Reps"
        subtitle={
          loading
            ? 'Loading...'
            : `${list.length} ${list.length === 1 ? 'person' : 'people'}${pendingCount ? ` - ${pendingCount} pending` : ''}`
        }
      />

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <LoadError title="Reps unavailable" onRetry={reload} />
      ) : list.length === 0 ? (
        <EmptyState icon={Users} title="No accounts yet" description="Reps appear here the moment they sign up." />
      ) : (
        <motion.div variants={staggerParent} initial="initial" animate="animate" className="flex flex-col gap-3">
          {list.map((p) => {
            const isSelf = p.id === user?.id
            return (
              <motion.div key={p.id} variants={staggerItem}>
                <GlassCard className={cn('p-4', !p.active && 'opacity-90')}>
                  <div className="flex items-center gap-3">
                    <Avatar name={displayName(p)} active={p.active} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-semibold text-white">{p.full_name ?? '-'}</p>
                        {isSelf && <Badge tone="primary">You</Badge>}
                        {p.role === 'admin' && (
                          <Badge tone="primary">
                            <ShieldCheck className="size-3" /> Admin
                          </Badge>
                        )}
                        {!p.active && <Badge tone="warn">Pending</Badge>}
                      </div>
                      <p className="truncate text-xs text-white/42">{p.email}</p>
                      <p className="mt-1 font-mono text-xs font-semibold tracking-wide text-demo-100 tnum">
                        {p.rep_code}
                      </p>
                    </div>
                    <Switch
                      checked={p.active}
                      onChange={() => toggleActive(p)}
                      disabled={isSelf || mutating.has(p.id)}
                      label="Active"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                    <span className="text-xs text-white/38">Joined {formatDate(p.created_at)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isSelf || mutating.has(p.id)}
                      onClick={() => toggleRole(p)}
                    >
                      {p.role === 'admin' ? 'Make rep' : 'Make admin'}
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

function displayName(p: Profile): string {
  return p.full_name ?? p.email ?? p.rep_code
}

function Avatar({ name, active }: { name: string; active: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-[8px] font-display text-lg font-bold ring-1 ring-inset',
        active
          ? 'bg-demo-400/13 text-demo-200 ring-demo-300/24'
          : 'bg-white/[0.06] text-white/34 ring-white/10',
      )}
    >
      {initial}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass rounded-[8px] p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-[8px]" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-40" />
            </div>
            <Skeleton className="h-7 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
