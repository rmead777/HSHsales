import { Link as RouterLink } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { motion } from 'motion/react'
import {
  ArrowRight,
  CreditCard,
  ExternalLink,
  LayoutGrid,
  Megaphone,
  QrCode,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../lib/useAsync'
import { formatDate } from '../lib/format'
import { fetchActiveAnnouncements, fetchActiveLinks, fetchMyEarnings, fetchMySales } from '../lib/queries'
import { formatAmount } from '../lib/format'
import { isThisMonth } from '../lib/commission'
import { SALE_EVENT } from '../lib/useSaleAlerts'
import { resolveLinkIcon } from '../lib/linkIcon'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadError } from '../components/ui/LoadError'
import { Button } from '../components/ui/Button'
import { BrandMark } from '../components/BrandMark'
import { springs, staggerItem, staggerParent } from '../lib/motion'
import type { Announcement, Link as LinkRow } from '../lib/database.types'

export function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const links = useAsync(fetchActiveLinks, [])
  const announcements = useAsync(fetchActiveAnnouncements, [])
  const firstName = (profile?.full_name ?? '').trim().split(' ')[0] || 'there'
  const repCode = profile?.rep_code ?? 'PENDING'
  const profileId = profile?.id ?? ''
  const earnings = useAsync(() => (profileId ? fetchMyEarnings(profileId) : Promise.resolve(null)), [profileId])
  const sales = useAsync(
    () => (profile?.rep_code ? fetchMySales(profile.rep_code) : Promise.resolve([])),
    [profile?.rep_code],
  )
  const monthSales = (sales.data ?? []).filter(
    (s) => isThisMonth(s.created_at) && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required'),
  ).length

  useEffect(() => {
    const reload = () => {
      void earnings.reload()
      void sales.reload()
    }
    window.addEventListener(SALE_EVENT, reload)
    return () => window.removeEventListener(SALE_EVENT, reload)
  }, [earnings, sales])

  return (
    <div className="flex flex-col gap-6">
      <Hero
        firstName={firstName}
        repCode={repCode}
        monthSales={sales.data ? monthSales : null}
        owedCents={earnings.data?.balance_cents ?? null}
        earnedCents={earnings.data?.earned_cents ?? null}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionHeading icon={Sparkles} title="Start a sale" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ActionCard to="/qr" icon={QrCode} title="QR code" tone="demo" />
          <ActionCard to="/checkout" icon={CreditCard} title="Checkout" tone="money" />
          <ActionCard to="/earnings" icon={Wallet} title="Earnings" tone="primary" />
        </div>
      </section>

      <AnnouncementsBlock
        loading={announcements.loading}
        error={announcements.error}
        items={announcements.data ?? []}
        onRetry={announcements.reload}
      />

      <section>
        <SectionHeading icon={LayoutGrid} title="Sales kit" />
        {links.loading ? (
          <LinksSkeleton />
        ) : links.error ? (
          <LoadError title="Sales kit unavailable" onRetry={links.reload} />
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
                ? 'Add a deck, pricing sheet, video, or training link. It appears here instantly.'
                : "Your admin hasn't added any links yet."
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

function Hero({
  firstName,
  repCode,
  monthSales,
  owedCents,
  earnedCents,
}: {
  firstName: string
  repCode: string
  monthSales: number | null
  owedCents: number | null
  earnedCents: number | null
}) {
  const monthLine =
    monthSales == null
      ? 'Your sales'
      : monthSales === 0
        ? 'No sales yet this month'
        : monthSales === 1
          ? '1 sale this month'
          : `${monthSales} sales this month`
  return (
    <GlassHero>
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-demo-300">{monthLine}</p>
            <h1 className="mt-2 font-display text-4xl font-extrabold leading-none tracking-[-0.05em] text-chrome">
              Hi, {firstName}
            </h1>
          </div>
          <BrandMark className="size-16 shrink-0" />
        </div>

        <p className="mt-4 max-w-sm text-sm leading-6 text-white/58">
          Show a customer your QR code or send them your checkout link. Every sale through them is
          credited to you.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <HeroMetric label="Your code" value={repCode} mono />
          <HeroMetric label="Owed to you" value={owedCents == null ? '-' : formatAmount(owedCents, 'usd')} />
          <HeroMetric label="Earned" value={earnedCents == null ? '-' : formatAmount(earnedCents, 'usd')} />
        </div>
      </div>
    </GlassHero>
  )
}

function GlassHero({ children }: { children: ReactNode }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: springs.standardExpressive }}
      className="glass-strong scanline-mask relative overflow-hidden rounded-[8px] p-5"
    >
      <div className="pointer-events-none absolute -right-14 -top-16 size-44 rounded-full bg-demo-400/16 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-14 left-4 size-36 rounded-full bg-danger-500/14 blur-3xl" />
      {children}
    </motion.header>
  )
}

function HeroMetric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col justify-between rounded-[8px] border border-white/10 bg-black/28 px-3 py-3">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className={`mt-1 truncate text-sm font-bold text-white tnum ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function SectionHeading({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-extrabold tracking-[-0.03em] text-white">
      <Icon className="size-[1.1rem] -mt-px text-demo-300" />
      {title}
    </h2>
  )
}

function ActionCard({
  to,
  icon: Icon,
  title,
  tone,
}: {
  to: string
  icon: LucideIcon
  title: string
  tone: 'demo' | 'money' | 'primary'
}) {
  const toneClasses = {
    demo: 'text-demo-200 bg-demo-400/13 border-demo-300/24',
    money: 'text-money-100 bg-money-400/13 border-money-300/24',
    primary: 'text-primary-100 bg-primary-400/14 border-primary-300/24',
  }[tone]

  return (
    <RouterLink to={to}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        transition={springs.press}
        className={`flex min-h-24 flex-col justify-between rounded-[8px] border p-3 ${toneClasses}`}
      >
        <Icon className="size-5" />
        <div className="flex items-center justify-between gap-2">
          <span className="whitespace-nowrap font-display text-base font-extrabold tracking-[-0.03em] text-white sm:text-lg">
            {title}
          </span>
          <ArrowRight className="hidden size-4 shrink-0 opacity-70 min-[420px]:block" />
        </div>
      </motion.div>
    </RouterLink>
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
      className="glass glass-hi group flex min-h-32 flex-col justify-between rounded-[8px] p-4"
    >
      <div className="relative flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-[8px] bg-demo-400/12 text-demo-300 ring-1 ring-demo-300/20">
          <Icon className="size-5" />
        </span>
        <ExternalLink className="size-4 text-white/28 transition group-hover:text-demo-300" />
      </div>
      <span className="relative mt-4 text-[0.95rem] font-bold leading-snug tracking-tight text-white">
        {link.label}
      </span>
    </motion.a>
  )
}

function AnnouncementsBlock({
  loading,
  error,
  items,
  onRetry,
}: {
  loading: boolean
  error: string | null
  items: Announcement[]
  onRetry: () => Promise<void>
}) {
  if (loading) return <Skeleton className="h-28 rounded-[8px]" />
  if (error) {
    return (
      <section>
        <SectionHeading icon={Megaphone} title="Team news" />
        <LoadError title="Team news could not load" onRetry={() => void onRetry()} />
      </section>
    )
  }
  if (items.length === 0) return null
  const [latest, ...rest] = items
  return (
    <section>
      <SectionHeading icon={Megaphone} title="Team news" />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: springs.standardExpressive }}
        className="flex flex-col gap-2"
      >
        <div className="relative overflow-hidden rounded-[8px] border border-danger-400/24 bg-danger-500/12 p-5 text-white shadow-[0_16px_40px_-26px_rgba(255,36,72,0.8)]">
          <div className="relative mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-danger-200">Latest</span>
            <span className="text-xs text-white/46">{formatDate(latest.created_at)}</span>
          </div>
          <p className="relative text-[0.95rem] font-semibold leading-relaxed text-white/82">{latest.body}</p>
        </div>
        {rest.map((a) => (
          <div key={a.id} className="glass rounded-[8px] px-4 py-3 text-sm leading-relaxed text-white/58">
            {a.body}
          </div>
        ))}
      </motion.div>
    </section>
  )
}

function LinksSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass rounded-[8px] p-4">
          <Skeleton className="size-11 rounded-[8px]" />
          <Skeleton className="mt-4 h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}
