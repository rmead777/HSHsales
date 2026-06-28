import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  BarChart3,
  Link as LinkIcon,
  Megaphone,
  Package,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from './ui/Badge'
import { springs } from '../lib/motion'
import { cn } from '../lib/cn'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const adminTabs: Tab[] = [
  { to: '/admin', label: 'Reps', icon: Users, end: true },
  { to: '/admin/links', label: 'Links', icon: LinkIcon },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/announcements', label: 'News', icon: Megaphone },
  { to: '/admin/sales', label: 'Sales', icon: BarChart3 },
]

/** Admin chrome: glass header + horizontally-scrollable tab strip. Wider max width than rep app. */
export function AdminShell() {
  const location = useLocation()
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="glass-nav sticky top-0 z-30 pt-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <NavLink
              to="/"
              aria-label="Back to app"
              className="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-900/5"
            >
              <ArrowLeft className="size-5" />
            </NavLink>
            <h1 className="font-display text-lg font-bold tracking-[-0.02em] text-slate-900">Admin</h1>
          </div>
          <Badge tone="primary">
            <ShieldDot /> Admin
          </Badge>
        </div>
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
          {adminTabs.map((t) => (
            <AdminTab key={t.to} tab={t} />
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: springs.standardFunctional }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.15, ease: 'easeIn' } }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

function AdminTab({ tab }: { tab: Tab }) {
  const { icon: Icon, label, to, end } = tab
  return (
    <NavLink
      to={to}
      end={end}
      className="relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold"
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="admin-tab-pill"
              transition={springs.standardFunctional}
              className="absolute inset-0 rounded-full bg-primary-500 shadow-[0_8px_20px_-8px_rgba(47,107,255,0.7)]"
            />
          )}
          <Icon className={cn('relative size-4', isActive ? 'text-white' : 'text-slate-500')} />
          <span className={cn('relative', isActive ? 'text-white' : 'text-slate-600')}>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function ShieldDot() {
  return <span className="size-1.5 rounded-full bg-primary-500" aria-hidden />
}
