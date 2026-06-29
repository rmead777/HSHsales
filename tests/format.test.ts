import { describe, expect, it } from 'vitest'
import { formatAmount, sumAmounts } from '../src/lib/format'

describe('money formatting', () => {
  it('formats minor units as localized currency', () => {
    const expected = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(3.5)
    expect(formatAmount(350, 'usd')).toBe(expected)
  })

  it('uses a calm placeholder for unknown amounts', () => {
    expect(formatAmount(null, 'usd')).toBe('-')
  })

  it('falls back cleanly when the currency code is invalid', () => {
    expect(formatAmount(1234, 'not-real')).toBe('12.34 NOT-REAL')
  })

  it('sums nullable minor-unit amounts before formatting', () => {
    const expected = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(6)
    expect(sumAmounts([100, null, 250, 250], 'usd')).toBe(expected)
  })
})
