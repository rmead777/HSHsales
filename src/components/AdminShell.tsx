import { NavLink, Outlet } from 'react-router-dom'
import { motion } from 'motion/react'
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
import { BrandMark } from './BrandMark'
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

/** Admin chrome: wider control room with compact, scrollable command tabs. */
export function AdminShell() {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-4xl flex-col">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-1 marquee-strip" aria-hidden />
      <header className="glass-nav sticky top-0 z-30 border-b border-white/10 pt-safe">
        <div className="flex items-center justify-between px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <NavLink
              to="/"
              aria-label="Back to app"
              className="grid size-10 shrink-0 place-items-center rounded-full text-white/56 transition hover:bg-white/[0.08] hover:text-white"
            >
              <ArrowLeft className="size-5" />
            </NavLink>
            <BrandMark className="hidden size-10 shrink-0 sm:block" />
            <div className="min-w-0">
              <p className="font-display text-lg font-extrabold tracking-[-0.03em] text-white">Admin</p>
              <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/38">
                Content control room
              </p>
            </div>
          </div>
          <Badge tone="primary">
            <ShieldDot /> Admin
          </Badge>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 sm:px-5">
          {adminTabs.map((t) => (
            <AdminTab key={t.to} tab={t} />
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-5">
        <Outlet />
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
      className="relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold"
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="admin-tab-pill"
              transition={springs.standardFunctional}
              className="absolute inset-0 rounded-full bg-demo-400 shadow-[0_12px_28px_-14px_rgba(46,234,255,0.9)]"
            />
          )}
          <Icon className={cn('relative size-4 -mt-px', isActive ? 'text-[#031014]' : 'text-white/48')} />
          <span className={cn('relative', isActive ? 'text-[#031014]' : 'text-white/62')}>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function ShieldDot() {
  return <span className="size-1.5 rounded-full bg-demo-300" aria-hidden />
}
