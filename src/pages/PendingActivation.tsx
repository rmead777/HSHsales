import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Hourglass, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { springs } from '../lib/motion'

export function PendingActivation() {
  const { profile, isActive, refreshProfile, signOut, user } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [checking, setChecking] = useState(false)

  // Poll gently while this screen is open, so the rep doesn't have to refresh manually.
  // (Hooks must run unconditionally — keep this above the early return below.)
  // Guard on `user` so a callback queued before logout can't fire with a stale session.
  useEffect(() => {
    if (!user) return
    const id = window.setInterval(() => {
      if (user) void refreshProfile()
    }, 15000)
    return () => window.clearInterval(id)
  }, [refreshProfile, user])

  // If activation lands (e.g. via the focus refetch), leave immediately.
  if (isActive) return <Navigate to="/" replace />

  async function checkNow() {
    setChecking(true)
    await refreshProfile()
    setChecking(false)
    show('Still pending — an admin will activate you soon.', 'info')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: springs.standardExpressive }}
        className="w-full max-w-sm"
      >
        <GlassCard strong className="flex flex-col items-center p-7 text-center">
          <motion.div
            className="grid size-16 place-items-center rounded-3xl bg-warn-50 text-warn-500 ring-1 ring-warn-100"
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Hourglass className="size-8" />
          </motion.div>

          <h1 className="mt-5 font-display text-2xl font-extrabold tracking-[-0.02em] text-slate-900">
            Account pending
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Your account is created but needs an admin to activate it. You'll get full access the
            moment that happens — this page updates itself.
          </p>

          {profile?.rep_code && (
            <div className="mt-5 w-full rounded-2xl bg-slate-900/[0.03] px-4 py-3">
              <p className="text-xs font-medium text-slate-400">Your rep code</p>
              <p className="mt-0.5 font-mono text-lg font-bold tracking-wider text-slate-800 tnum">
                {profile.rep_code}
              </p>
            </div>
          )}

          <div className="mt-6 flex w-full flex-col gap-2.5">
            <Button onClick={checkNow} loading={checking} fullWidth>
              <RefreshCw className="size-4" />
              Check again
            </Button>
            <Button onClick={handleSignOut} variant="ghost" fullWidth>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  )
}
