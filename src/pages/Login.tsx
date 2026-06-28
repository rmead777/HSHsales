import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { BrandMark } from '../components/BrandMark'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { springs } from '../lib/motion'
import { cn } from '../lib/cn'

type Mode = 'signin' | 'signup'

export function Login() {
  const { session, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Already signed in → let the guards decide where to land.
  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password)
        if (error) {
          setError(error)
        } else {
          navigate('/', { replace: true })
        }
      } else {
        const { needsConfirmation, alreadyExists, error } = await signUp(
          email.trim(),
          password,
          fullName.trim() || undefined,
        )
        if (error) {
          setError(error)
        } else if (alreadyExists) {
          setInfo('That email may already be registered. Try signing in instead.')
          setMode('signin')
        } else if (needsConfirmation) {
          setInfo(`Almost there — check ${email.trim()} to confirm your email, then sign in.`)
        } else {
          show('Account created — welcome!', 'success')
          navigate('/', { replace: true })
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: springs.standardExpressive }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, transition: { ...springs.expressive, delay: 0.05 } }}
          >
            <BrandMark className="size-16 drop-shadow-[0_12px_30px_rgba(47,107,255,0.35)]" />
          </motion.div>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.03em] text-slate-900">
            High Score Host
          </h1>
          <p className="mt-1 text-sm text-slate-500">Your attributed links, QR codes & checkout.</p>
        </div>

        <GlassCard strong className="p-5">
          {/* Segmented sign in / create account */}
          <div className="relative mb-5 grid grid-cols-2 rounded-2xl bg-slate-900/[0.04] p-1">
            {(['signin', 'signup'] as Mode[]).map((m) => {
              const active = mode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m)
                    setError(null)
                    setInfo(null)
                  }}
                  className="relative h-10 rounded-xl text-sm font-semibold"
                >
                  {active && (
                    <motion.span
                      layoutId="auth-seg"
                      transition={springs.standardFunctional}
                      className="absolute inset-0 rounded-xl bg-white shadow-[0_4px_14px_-6px_rgba(15,23,42,0.3)]"
                    />
                  )}
                  <span className={cn('relative', active ? 'text-slate-900' : 'text-slate-500')}>
                    {m === 'signin' ? 'Sign in' : 'Create account'}
                  </span>
                </button>
              )
            })}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <Field label="Full name">
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jordan Rivera"
                  autoComplete="name"
                />
              </Field>
            )}
            <Field label="Email">
              <Input
                type="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </Field>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-danger-50 px-3 py-2 text-sm font-medium text-danger-600"
              >
                {error}
              </motion.p>
            )}
            {info && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 rounded-xl bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700"
              >
                <Mail className="mt-0.5 size-4 shrink-0" />
                <span>{info}</span>
              </motion.p>
            )}

            <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-1">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
              {!submitting && <ArrowRight className="size-5" />}
            </Button>
          </form>
        </GlassCard>

        <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">
          New accounts start <span className="font-semibold text-slate-500">pending</span> until an
          admin activates them.
        </p>
      </motion.div>
    </div>
  )
}
