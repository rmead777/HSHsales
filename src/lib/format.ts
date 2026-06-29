/** Format integer minor units (cents) + ISO currency into a localized money string. */
export function formatAmount(cents: number | null, currency: string | null): string {
  if (cents == null) return '-'
  const value = cents / 100
  const code = (currency ?? 'usd').toUpperCase()
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value)
  } catch {
    return `${value.toFixed(2)} ${code}`
  }
}

/** Sum minor-unit sale amounts into localized money. Assumes a single dominant currency. */
export function sumAmounts(amounts: Array<number | null>, currency: string | null): string {
  const total = amounts.reduce<number>((acc, a) => acc + (a ?? 0), 0)
  return formatAmount(total, currency)
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}
