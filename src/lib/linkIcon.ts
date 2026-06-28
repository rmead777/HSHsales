import {
  BookOpen,
  CreditCard,
  ExternalLink,
  GraduationCap,
  LifeBuoy,
  Megaphone,
  Package,
  Play,
  Presentation,
  Tag,
  type LucideIcon,
} from 'lucide-react'

// Map a link's `icon` field (or a keyword in its label) to a lucide glyph. Falls back to a
// neutral "external link" so unknown labels still render cleanly.
const map: Record<string, LucideIcon> = {
  deck: Presentation,
  slides: Presentation,
  presentation: Presentation,
  pricing: Tag,
  price: Tag,
  product: Package,
  kit: Package,
  kits: Package,
  launchkit: Package,
  video: Play,
  videos: Play,
  training: GraduationCap,
  help: LifeBuoy,
  support: LifeBuoy,
  faq: LifeBuoy,
  info: BookOpen,
  docs: BookOpen,
  doc: BookOpen,
  announcement: Megaphone,
  announcements: Megaphone,
  news: Megaphone,
  checkout: CreditCard,
}

export function resolveLinkIcon(name?: string | null): LucideIcon {
  if (!name) return ExternalLink
  const key = name.toLowerCase().replace(/[^a-z]/g, '')
  return map[key] ?? ExternalLink
}
