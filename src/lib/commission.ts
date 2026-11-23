import type { CommissionType, Sale, SaleStatus } from './database.types'
import { formatAmount } from './format'

// Display-side commission helpers. The database is the source of truth for what a sale
// earned (migration 0005 computes `sales.commission_cents`); these only preview and describe.

export interface CommissionRule {
  type: CommissionType
  value: number
}

type RuleColumns = { commission_type: CommissionType | null; commission_value: number | null }

export function ruleOf(row: RuleColumns | null | undefined): CommissionRule | null {
  if (!row?.commission_type || row.commission_value == null) return null
  const value = Number(row.commission_value)
  return Number.isFinite(value) ? { type: row.commission_type, value } : null
}

/** Same order the database uses: the rep's own rate, else the product's rate. */
export function effectiveRule(
  profile: RuleColumns | null | undefined,
  product: RuleColumns | null | undefined,
): CommissionRule | null {
  return ruleOf(profile) ?? ruleOf(product)
}

/** What one sale at `priceCents` earns under `rule`. null when a percent rule has no price. */
export function previewCommissionCents(rule: CommissionRule | null, priceCents: number | null): number | null {
  if (!rule) return null
  if (rule.type === 'flat') return Math.round(rule.value * 100)
  if (priceCents == null) return null
  return Math.round((priceCents * rule.value) / 100)
}

/** "10% of each sale" or "$100.00 per sale". */
export function describeRule(rule: CommissionRule | null): string {
  if (!rule) return 'No commission set'
  if (rule.type === 'percent') return `${trimNumber(rule.value)}% of each sale`
  return `${formatAmount(Math.round(rule.value * 100), 'usd')} per sale`
}

/** Short form for badges: "10%" or "$100.00". */
export function shortRule(rule: CommissionRule | null): string {
  if (!rule) return 'Not set'
  return rule.type === 'percent' ? `${trimNumber(rule.value)}%` : formatAmount(Math.round(rule.value * 100), 'usd')
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/** "$1,000.50", "1000.5", "1,000" -> cents. null if it isn't a non-negative amount. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}

/** Dollars or percent typed by an admin -> number, or null if invalid. */
export function parseRuleValue(input: string): number | null {
  const cleaned = input.replace(/[$%,\s]/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null
  return Number(cleaned)
}

/** Plain label for where a sale's money stands. */
export function saleStatusLabel(sale: Pick<Sale, 'payment_status' | 'amount' | 'amount_refunded'>): {
  label: string
  tone: 'money' | 'warn' | 'danger' | 'neutral'
} {
  const status: SaleStatus = sale.payment_status
  if (status === 'unpaid') return { label: 'Waiting for payment', tone: 'warn' }
  if (status === 'failed') return { label: 'Payment failed', tone: 'danger' }
  const amount = sale.amount ?? 0
  if (sale.amount_refunded > 0 && sale.amount_refunded >= amount) return { label: 'Refunded', tone: 'danger' }
  if (sale.amount_refunded > 0) return { label: 'Partly refunded', tone: 'warn' }
  return { label: 'Paid', tone: 'money' }
}

/** Calendar-month boundary in the viewer's time zone. */
export function isThisMonth(iso: string, now = new Date()): boolean {
  const d = new Date(iso)
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}
