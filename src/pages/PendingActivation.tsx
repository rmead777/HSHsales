import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Hourglass, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { BrandMark } from '../components/BrandMark'
import { springs } from '../lib/motion'

export function PendingActivation() {
  const { profile, isActive, refreshProfile, signOut, user } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!user) return
    const id = window.setInterval(() => {
      if (user) void refreshProfile()
    }, 15000)
    return () => window.clearInterval(id)
  }, [refreshProfile, user])

  if (isActive) return <Navigate to="/" replace />

  async function checkNow() {
    setChecking(true)
    await refreshProfile()
    setChecking(false)
    show('Still pending - an admin will activate you soon.', 'info')
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
          <BrandMark className="size-16" />
          <motion.div
            className="mt-5 grid size-14 place-items-center rounded-[8px] bg-warn-400/13 text-warn-100 ring-1 ring-warn-400/24"
            animate={{ opacity: [0.78, 1, 0.78] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          >
            <Hourglass className="size-7" />
          </motion.div>

          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-warn-300">Activation gate</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.04em] text-white">
            Account pending
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/56">
            Your account exists and is waiting for an admin activation. This screen checks
            automatically, because refreshing manually is a tiny tax nobody asked to pay.
          </p>

          {profile?.rep_code && (
            <div className="mt-5 w-full rounded-[8px] border border-white/10 bg-black/28 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/36">Your rep code</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-wider text-demo-100 tnum">
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
