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

/** Rep-facing chrome: glass header + animated glass bottom nav, content in the Outlet. */
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
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <Header
        repCode={profile?.rep_code ?? null}
        name={profile?.full_name ?? profile?.email ?? null}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 px-4 pt-4 pb-safe-nav">
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

      <nav className="glass-nav fixed inset-x-0 bottom-0 z-40 pb-safe">
        <div className="mx-auto flex max-w-xl items-stretch justify-around px-2 py-2">
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
    <header className="glass-nav sticky top-0 z-30 pt-safe">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="size-9 shrink-0 drop-shadow-sm" />
          <div className="min-w-0 leading-tight">
            <p className="font-display text-[0.95rem] font-bold tracking-[-0.02em] text-slate-900">
              High Score Host
            </p>
            {name && <p className="truncate text-xs text-slate-400">{name}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {repCode && <RepCodeBadge code={repCode} />}
          <button
            onClick={onSignOut}
            aria-label="Sign out"
            className="grid size-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-900/5"
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
      className="rounded-full bg-primary-50 px-3 py-1.5 font-mono text-xs font-semibold tracking-wide text-primary-700 ring-1 ring-inset ring-primary-200 tnum"
      title="Your rep code — tap to copy"
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
      className="relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-1.5"
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="rep-nav-pill"
              transition={springs.standardFunctional}
              className="absolute inset-0 rounded-2xl bg-primary-500/10"
            />
          )}
          <Icon
            className={cn(
              'relative size-6 transition-colors',
              isActive ? 'text-primary-600' : 'text-slate-400',
            )}
          />
          <span
            className={cn(
              'relative text-[0.65rem] font-semibold tracking-tight',
              isActive ? 'text-primary-700' : 'text-slate-400',
            )}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}
