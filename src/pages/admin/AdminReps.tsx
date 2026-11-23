import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { useAsync } from '../../lib/useAsync'
import {
  fetchProfiles,
  fetchRepEarnings,
  setProfileActive,
  setProfileCommission,
  setProfileRole,
} from '../../lib/queries'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { GlassCard } from '../../components/ui/GlassCard'
import { Switch } from '../../components/ui/Switch'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadError } from '../../components/ui/LoadError'
import { formatAmount, formatDate } from '../../lib/format'
import { parseRuleValue, ruleOf, shortRule } from '../../lib/commission'
import { Sheet } from '../../components/ui/Sheet'
import { Input } from '../../components/ui/Field'
import { staggerItem, staggerParent } from '../../lib/motion'
import { cn } from '../../lib/cn'
import type { CommissionType, Profile, Role } from '../../lib/database.types'

export function AdminReps() {
  const { user } = useAuth()
  const { show } = useToast()
  const { data, loading, error, reload } = useAsync(fetchProfiles, [])
  const earnings = useAsync(fetchRepEarnings, [])
  const owedByCode = useMemo(
    () => new Map((earnings.data ?? []).map((e) => [e.rep_code, e.balance_cents])),
    [earnings.data],
  )
  const [list, setList] = useState<Profile[]>([])
  const [mutating, setMutating] = useState<Set<string>>(new Set())
  const [rateFor, setRateFor] = useState<Profile | null>(null)

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
                    <span className="text-xs text-white/38">
                      Joined {formatDate(p.created_at)}
                      {owedByCode.get(p.rep_code) ? (
                        <span className="ml-2 font-semibold text-money-200 tnum">
                          Owed {formatAmount(owedByCode.get(p.rep_code) ?? 0, 'usd')}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setRateFor(p)}>
                        Rate: {ruleOf(p) ? shortRule(ruleOf(p)) : 'product'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isSelf || mutating.has(p.id)}
                        onClick={() => toggleRole(p)}
                      >
                        {p.role === 'admin' ? 'Make rep' : 'Make admin'}
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <RateSheet
        profile={rateFor}
        onClose={() => setRateFor(null)}
        onSave={async (type, value) => {
          if (!rateFor) return
          await setProfileCommission(rateFor.id, type, value)
          setList((prev) =>
            prev.map((x) => (x.id === rateFor.id ? { ...x, commission_type: type, commission_value: value } : x)),
          )
          show(type ? `${displayName(rateFor)} now earns ${shortRule({ type, value: value ?? 0 })}` : `${displayName(rateFor)} uses product rates`, 'success')
          setRateFor(null)
        }}
      />
    </div>
  )
}

type RateChoice = 'product' | CommissionType

/** A rep's own commission rate. It replaces product rates on that rep's new sales. */
function RateSheet({
  profile,
  onClose,
  onSave,
}: {
  profile: Profile | null
  onClose: () => void
  onSave: (type: CommissionType | null, value: number | null) => Promise<void>
}) {
  const [choice, setChoice] = useState<RateChoice>('product')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    setChoice(profile.commission_type ?? 'product')
    setValue(profile.commission_value == null ? '' : String(profile.commission_value))
    setSaving(false)
  }, [profile])

  const parsed = parseRuleValue(value)
  const valid = choice === 'product' || (parsed != null && (choice === 'flat' || parsed <= 100))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    try {
      await onSave(choice === 'product' ? null : choice, choice === 'product' ? null : parsed)
    } catch {
      setSaving(false)
    }
  }

  const options: Array<[RateChoice, string]> = [
    ['product', 'Product rates'],
    ['percent', '% of sale'],
    ['flat', '$ per sale'],
  ]

  return (
    <Sheet open={!!profile} onClose={onClose} title={`Commission for ${profile ? displayName(profile) : ''}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm leading-6 text-white/58">
          By default each sale earns the rate set on its product. Give this person their own rate and it
          applies to their new sales instead. Past sales keep the rate they were recorded with.
        </p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Commission rate">
          {options.map(([opt, label]) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={choice === opt}
              onClick={() => setChoice(opt)}
              className={cn(
                'h-11 rounded-[8px] border text-sm font-bold transition-colors',
                choice === opt
                  ? 'border-money-300/40 bg-money-400/16 text-money-100'
                  : 'border-white/12 bg-black/28 text-white/56 hover:border-white/24',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {choice !== 'product' && (
          <div>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={choice === 'percent' ? '10' : '100'}
              inputMode="decimal"
              aria-label={choice === 'percent' ? 'Percent of each sale' : 'Dollars per sale'}
              autoFocus
            />
            {!valid && value.trim() && (
              <span className="mt-2 block text-xs font-semibold text-danger-400">
                {choice === 'percent' ? 'Enter a percent from 0 to 100' : 'Enter a dollar amount'}
              </span>
            )}
          </div>
        )}
        <Button type="submit" fullWidth loading={saving} disabled={!valid}>
          Save
        </Button>
      </form>
    </Sheet>
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
