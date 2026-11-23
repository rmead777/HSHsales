import { describe, expect, it } from 'vitest'
import {
  describeRule,
  effectiveRule,
  parseMoneyToCents,
  parseRuleValue,
  previewCommissionCents,
  saleStatusLabel,
} from '../src/lib/commission'
import { buildAttributedPaymentLink } from '../src/lib/attribution'
import { matchProduct, normalizePaymentLink } from '../api/stripe-webhook'

const none = { commission_type: null, commission_value: null }

describe('commission preview', () => {
  it('uses the rep rate over the product rate, like the database', () => {
    const rule = effectiveRule(
      { commission_type: 'flat', commission_value: 150 },
      { commission_type: 'percent', commission_value: 10 },
    )
    expect(rule).toEqual({ type: 'flat', value: 150 })
    expect(effectiveRule(none, { commission_type: 'percent', commission_value: 10 })).toEqual({
      type: 'percent',
      value: 10,
    })
    expect(effectiveRule(none, none)).toBeNull()
  })

  it('previews percent and flat commissions', () => {
    expect(previewCommissionCents({ type: 'percent', value: 10 }, 99900)).toBe(9990)
    expect(previewCommissionCents({ type: 'percent', value: 12.5 }, 99900)).toBe(12488)
    expect(previewCommissionCents({ type: 'flat', value: 100 }, null)).toBe(10000)
    expect(previewCommissionCents({ type: 'percent', value: 10 }, null)).toBeNull()
    expect(describeRule({ type: 'percent', value: 10 })).toBe('10% of each sale')
  })

  it('parses what admins type', () => {
    expect(parseMoneyToCents('$1,000.50')).toBe(100050)
    expect(parseMoneyToCents('999')).toBe(99900)
    expect(parseMoneyToCents('-5')).toBeNull()
    expect(parseMoneyToCents('abc')).toBeNull()
    expect(parseRuleValue('12.5%')).toBe(12.5)
  })

  it('labels where the money stands', () => {
    expect(saleStatusLabel({ payment_status: 'paid', amount: 100, amount_refunded: 0 }).label).toBe('Paid')
    expect(saleStatusLabel({ payment_status: 'paid', amount: 100, amount_refunded: 40 }).label).toBe('Partly refunded')
    expect(saleStatusLabel({ payment_status: 'paid', amount: 100, amount_refunded: 100 }).label).toBe('Refunded')
    expect(saleStatusLabel({ payment_status: 'unpaid', amount: 100, amount_refunded: 0 }).label).toBe(
      'Waiting for payment',
    )
  })
})

describe('rep links with a discount code', () => {
  it('adds prefilled_promo_code only when the product has one', () => {
    const withCode = new URL(buildAttributedPaymentLink('https://buy.stripe.com/abc', 'REP1', ' LAUNCH20 '))
    expect(withCode.searchParams.get('client_reference_id')).toBe('REP1')
    expect(withCode.searchParams.get('prefilled_promo_code')).toBe('LAUNCH20')
    const without = new URL(buildAttributedPaymentLink('https://buy.stripe.com/abc', 'REP1', null))
    expect(without.searchParams.has('prefilled_promo_code')).toBe(false)
  })
})

describe('webhook product matching', () => {
  const products = [
    { id: 'kit', name: 'Launch Kit', stripe_payment_link: 'https://buy.stripe.com/abc', promo_code: null },
    { id: 'kit20', name: 'Launch Kit 20% off', stripe_payment_link: 'https://buy.stripe.com/abc/', promo_code: 'LAUNCH20' },
    { id: 'sub', name: 'Subscription', stripe_payment_link: 'https://buy.stripe.com/xyz', promo_code: null },
  ]

  it('compares links by host and path only', () => {
    expect(normalizePaymentLink('https://BUY.stripe.com/abc/?client_reference_id=R')).toBe('buy.stripe.com/abc')
    expect(normalizePaymentLink('not a url')).toBeNull()
  })

  it('matches by Payment Link, using the discount code to choose between versions', () => {
    expect(matchProduct(products, 'https://buy.stripe.com/xyz', null)?.id).toBe('sub')
    expect(matchProduct(products, 'https://buy.stripe.com/abc', null)?.id).toBe('kit')
    expect(matchProduct(products, 'https://buy.stripe.com/abc', 'launch20')?.id).toBe('kit20')
    expect(matchProduct(products, 'https://buy.stripe.com/other', null)).toBeNull()
    expect(matchProduct(products, null, null)).toBeNull()
  })
})
