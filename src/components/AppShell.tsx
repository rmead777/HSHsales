import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CreditCard, LayoutGrid, LogOut, QrCode, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from './ui/Toast'
import { BrandMark } from './BrandMark'
import { copyText } from '../lib/share'
import { springs } from '../lib/motion'
import { cn } from '../lib/cn'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const repTabs: Tab[] = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/checkout', label: 'Checkout', icon: CreditCard },
  { to: '/qr', label: 'QR Codes', icon: QrCode },
]

/** Rep-facing chrome: compact arcade console for fast field selling. */
export function AppShell() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const tabs: Tab[] = isAdmin
    ? [...repTabs, { to: '/admin', label: 'Admin', icon: ShieldCheck }]
    : repTabs

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-xl flex-col">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-1 marquee-strip" aria-hidden />
      <Header
        repCode={profile?.rep_code ?? null}
        name={profile?.full_name ?? profile?.email ?? null}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 px-4 pt-4 pb-safe-nav sm:px-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: springs.standardFunctional }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="glass-nav fixed inset-x-0 bottom-0 z-40 border-t border-white/10 pb-safe">
        <div
          className="mx-auto grid max-w-xl gap-2 px-3 py-2"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((t) => (
            <NavTab key={t.to} tab={t} />
          ))}
        </div>
      </nav>
    </div>
  )
}

function Header({
  repCode,
  name,
  onSignOut,
}: {
  repCode: string | null
  name: string | null
  onSignOut: () => void
}) {
  return (
    <header className="glass-nav sticky top-0 z-30 border-b border-white/10 pt-safe">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="size-10 shrink-0 drop-shadow-[0_14px_26px_rgba(46,234,255,0.22)]" />
          <div className="min-w-0 leading-tight">
            <p className="font-display text-base font-extrabold tracking-[-0.03em] text-chrome">
              High Score Host
            </p>
            <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/38">
              {name ?? 'Rep console'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {repCode && <RepCodeBadge code={repCode} />}
          <button
            onClick={onSignOut}
            aria-label="Sign out"
            className="grid size-10 place-items-center rounded-full text-white/50 transition hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </div>
    </header>
  )
}

function RepCodeBadge({ code }: { code: string }) {
  const { show } = useToast()
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      transition={springs.press}
      onClick={async () => {
        const r = await copyText(code)
        show(r === 'failed' ? 'Could not copy' : 'Rep code copied', r === 'failed' ? 'error' : 'success')
      }}
      className="rounded-full border border-demo-300/25 bg-demo-400/12 px-3 py-1.5 font-mono text-xs font-bold tracking-wide text-demo-100 shadow-[0_10px_26px_-18px_rgba(46,234,255,0.9)] tnum"
      title="Your rep code - tap to copy"
    >
      {code}
    </motion.button>
  )
}

function NavTab({ tab }: { tab: Tab }) {
  const { icon: Icon, label, to, end } = tab
  return (
    <NavLink
      to={to}
      end={end}
      className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[8px] py-1.5"
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="rep-nav-pill"
              transition={springs.standardFunctional}
              className="absolute inset-0 rounded-[8px] bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_26px_-20px_rgba(46,234,255,0.9)]"
            />
          )}
          <Icon
            className={cn(
              'relative size-6 transition-colors',
              isActive ? 'text-demo-300' : 'text-white/34',
            )}
          />
          <span
            className={cn(
              'relative text-[0.65rem] font-bold tracking-[0.02em]',
              isActive ? 'text-white' : 'text-white/38',
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}
