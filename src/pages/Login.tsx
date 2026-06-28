import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Gamepad2, Mail, QrCode, ShieldCheck, Trophy, type LucideIcon } from 'lucide-react'
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
          setInfo(`Almost there - check ${email.trim()} to confirm your email, then sign in.`)
        } else {
          show('Account created - welcome!', 'success')
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
    <div className="relative min-h-dvh overflow-hidden px-5 py-8 sm:px-8 lg:px-10">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-1 marquee-strip" aria-hidden />
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0, transition: springs.standardExpressive }}
          className="hidden lg:block"
        >
          <div className="mb-8 flex items-center gap-4">
            <BrandMark className="size-20 shrink-0" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-demo-300">High Score Host</p>
              <p className="mt-1 font-display text-2xl font-extrabold tracking-[-0.04em] text-white">
                Sales console
              </p>
            </div>
          </div>

          <h1 className="max-w-3xl font-display text-6xl font-extrabold leading-[0.92] tracking-[-0.05em] text-chrome">
            Turn every scan into a credited sale.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/62">
            A field-ready launcher for attributed Stripe links, QR codes, demo handoffs, and rep
            activation. The buyer gets the game. The rep gets the credit. Everyone stops asking
            which link they were supposed to use.
          </p>

          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
            <SignalPill icon={QrCode} label="Scan" value="QR ready" />
            <SignalPill icon={Gamepad2} label="Play" value="Demo tagged" />
            <SignalPill icon={Trophy} label="Credit" value="Rep locked" />
          </div>

          <ArcadePreview />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: springs.standardExpressive }}
          className="mx-auto w-full max-w-md"
        >
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <BrandMark className="size-20 drop-shadow-[0_20px_42px_rgba(46,234,255,0.26)]" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.26em] text-demo-300">High Score Host</p>
            <h1 className="mt-2 font-display text-4xl font-extrabold leading-none tracking-[-0.05em] text-chrome">
              Sales console
            </h1>
          </div>

          <GlassCard strong className="p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-white/38">
                  {mode === 'signin' ? 'Welcome back' : 'Request access'}
                </p>
                <h2 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.04em] text-white">
                  {mode === 'signin' ? 'Enter the cabinet' : 'Create your rep pass'}
                </h2>
              </div>
              <div className="grid size-11 place-items-center rounded-[8px] bg-demo-400/12 text-demo-300 ring-1 ring-demo-300/24">
                <ShieldCheck className="size-5" />
              </div>
            </div>

            <div className="relative mb-5 grid grid-cols-2 rounded-[8px] border border-white/10 bg-black/26 p-1">
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
                    className="relative h-10 rounded-[6px] text-sm font-bold"
                  >
                    {active && (
                      <motion.span
                        layoutId="auth-seg"
                        transition={springs.standardFunctional}
                        className="absolute inset-0 rounded-[6px] bg-demo-400 shadow-[0_12px_24px_-16px_rgba(46,234,255,0.9)]"
                      />
                    )}
                    <span className={cn('relative', active ? 'text-[#031014]' : 'text-white/48')}>
                      {m === 'signin' ? 'Sign in' : 'Create'}
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
                  placeholder="minimum 6 characters"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </Field>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[8px] border border-danger-400/20 bg-danger-500/12 px-3 py-2 text-sm font-semibold text-danger-100"
                >
                  {error}
                </motion.p>
              )}
              {info && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 rounded-[8px] border border-demo-300/20 bg-demo-400/10 px-3 py-2 text-sm font-semibold text-demo-100"
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

          <p className="mx-auto mt-5 max-w-sm text-center text-xs leading-relaxed text-white/42">
            New accounts start pending until an admin activates the rep profile. Very exclusive.
            Slightly velvet-rope, mostly database.
          </p>
        </motion.section>
      </div>
    </div>
  )
}

function SignalPill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="cabinet-panel rounded-[8px] p-4">
      <Icon className="size-5 text-demo-300" />
      <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-white/38">{label}</p>
      <p className="mt-1 font-display text-xl font-extrabold tracking-[-0.03em] text-white">{value}</p>
    </div>
  )
}

function ArcadePreview() {
  return (
    <div className="cabinet-panel scanline-mask mt-8 max-w-2xl rounded-[8px] p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-danger-400">Live loop</p>
          <p className="mt-1 text-sm font-semibold text-white/58">Demo to checkout in two taps</p>
        </div>
        <div className="flex gap-2">
          <span className="size-3 rounded-full bg-danger-500 shadow-[0_0_16px_rgba(255,36,72,0.6)]" />
          <span className="size-3 rounded-full bg-warn-400 shadow-[0_0_16px_rgba(245,164,0,0.55)]" />
          <span className="size-3 rounded-full bg-demo-400 shadow-[0_0_16px_rgba(46,234,255,0.55)]" />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
        <LoopStep number="01" label="Scan QR" />
        <ArrowRight className="size-5 text-demo-300" />
        <LoopStep number="02" label="Play game" />
        <ArrowRight className="size-5 text-danger-400" />
        <LoopStep number="03" label="Buy now" />
      </div>
    </div>
  )
}

function LoopStep({ number, label }: { number: string; label: string }) {
  return (
    <div className="rounded-[8px] border border-white/10 bg-black/30 p-4">
      <p className="font-mono text-xs font-bold text-white/36 tnum">{number}</p>
      <p className="mt-2 font-display text-lg font-extrabold tracking-[-0.03em] text-white">{label}</p>
    </div>
  )
}
