import { describe, expect, it } from 'vitest'
import {
  buildAttributedPaymentLink,
  buildDemoUrl,
  safeBuildAttributedPaymentLink,
  safeBuildDemoUrl,
  sanitizeRepCode,
} from '../src/lib/attribution'

describe('attribution helpers', () => {
  it('sanitizes rep codes for Stripe client_reference_id', () => {
    expect(sanitizeRepCode('Ryan.Mead+east/team:alpha ')).toBe('Ryan_Mead_east_team_alpha_')
    expect(sanitizeRepCode('a'.repeat(205))).toHaveLength(200)
  })

  it('adds client_reference_id without dropping existing payment link params', () => {
    const url = new URL(
      buildAttributedPaymentLink('https://buy.stripe.com/test_123?prefilled_email=buyer%40example.com', 'REP-007'),
    )

    expect(url.origin + url.pathname).toBe('https://buy.stripe.com/test_123')
    expect(url.searchParams.get('prefilled_email')).toBe('buyer@example.com')
    expect(url.searchParams.get('client_reference_id')).toBe('REP-007')
  })

  it('keeps demo referrals tagged with sanitized rep codes', () => {
    const url = new URL(buildDemoUrl('https://demo.highscorehost.com/play?campaign=q3', 'rep east'))

    expect(url.searchParams.get('campaign')).toBe('q3')
    expect(url.searchParams.get('ref')).toBe('rep_east')
  })

  it('returns null from safe builders for malformed admin URLs', () => {
    expect(safeBuildAttributedPaymentLink('not a url', 'REP')).toBeNull()
    expect(safeBuildDemoUrl(undefined, 'REP')).toBeNull()
    expect(safeBuildDemoUrl('also not a url', 'REP')).toBeNull()
  })
})
