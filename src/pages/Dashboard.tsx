import { Link as RouterLink } from 'react-router-dom'
import { motion } from 'motion/react'
import { ExternalLink, LayoutGrid, Megaphone, type LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../lib/useAsync'
import { fetchActiveAnnouncements, fetchActiveLinks } from '../lib/queries'
import { resolveLinkIcon } from '../lib/linkIcon'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { springs, staggerItem, staggerParent } from '../lib/motion'
import type { Announcement, Link as LinkRow } from '../lib/database.types'

export function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const links = useAsync(fetchActiveLinks, [])
  const announcements = useAsync(fetchActiveAnnouncements, [])
  const firstName = (profile?.full_name ?? '').trim().split(' ')[0] || 'there'

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-sm font-medium text-slate-400">Welcome back</p>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-slate-900">
          Hi, {firstName}
        </h1>
      </header>

      <AnnouncementsBlock loading={announcements.loading} items={announcements.data ?? []} />

      <section>
        <SectionHeading icon={LayoutGrid} title="Quick links" />
        {links.loading ? (
          <LinksSkeleton />
        ) : links.data && links.data.length > 0 ? (
          <motion.div
            variants={staggerParent}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 gap-3"
          >
            {links.data.map((link) => (
              <LinkTile key={link.id} link={link} />
            ))}
          </motion.div>
        ) : (
          <EmptyState
            icon={ExternalLink}
            title="No links yet"
            description={
              isAdmin
                ? 'Add your first link in the admin panel — it appears here instantly.'
                : "Your admin hasn't added links yet. Check back soon."
            }
            action={
              isAdmin ? (
                <RouterLink to="/admin/links">
                  <Button size="sm">Manage links</Button>
                </RouterLink>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  )
}

function SectionHeading({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.01em] text-slate-800">
        <Icon className="size-[1.1rem] text-slate-400" />
        {title}
      </h2>
    </div>
  )
}

function LinkTile({ link }: { link: LinkRow }) {
  const Icon = resolveLinkIcon(link.icon ?? link.label)
  return (
    <motion.a
      variants={staggerItem}
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      whileTap={{ scale: 0.97 }}
      transition={springs.press}
      className="glass glass-hi group flex flex-col gap-3 rounded-3xl p-4"
    >
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-primary-50 text-primary-600">
          <Icon className="size-5" />
        </span>
        <ExternalLink className="size-4 text-slate-300 transition group-hover:text-slate-400" />
      </div>
      <span className="text-[0.95rem] font-bold leading-snug tracking-tight text-slate-800">
        {link.label}
      </span>
    </motion.a>
  )
}

function AnnouncementsBlock({ loading, items }: { loading: boolean; items: Announcement[] }) {
  if (loading) return <Skeleton className="h-24 rounded-3xl" />
  if (items.length === 0) return null
  const [latest, ...rest] = items
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: springs.standardExpressive }}
      className="flex flex-col gap-2"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 to-primary-600 p-5 text-white shadow-[0_18px_44px_-18px_rgba(47,107,255,0.75)]">
        {/* one deliberate decorative element for depth */}
        <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/10 blur-xl" />
        <div className="relative mb-2 flex items-center gap-2 text-primary-100">
          <Megaphone className="size-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Announcement</span>
        </div>
        <p className="relative text-[0.95rem] font-medium leading-relaxed">{latest.body}</p>
      </div>
      {rest.map((a) => (
        <div key={a.id} className="glass rounded-2xl px-4 py-3 text-sm leading-relaxed text-slate-600">
          {a.body}
        </div>
      ))}
    </motion.div>
  )
}

function LinksSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass rounded-3xl p-4">
          <Skeleton className="size-11 rounded-2xl" />
          <Skeleton className="mt-4 h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}
