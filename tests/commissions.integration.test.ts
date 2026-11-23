// End-to-end check of commissions against a LOCAL Supabase (never the live project).
// Run:  supabase start   then
//       LOCAL_SUPABASE_URL=http://127.0.0.1:54321 LOCAL_SUPABASE_ANON_KEY=... LOCAL_SUPABASE_SERVICE_KEY=... npx vitest run tests/commissions.integration.test.ts
// Skipped when those variables are not set, so `npm test` stays offline.

import { beforeAll, describe, expect, it } from 'vitest'
import Stripe from 'stripe'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { POST, handleStripeEvent } from '../api/stripe-webhook'

const url = process.env.LOCAL_SUPABASE_URL
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_KEY
const enabled = !!(url && anonKey && serviceKey && /127\.0\.0\.1|localhost/.test(url))

const run = Date.now().toString(36)
const LINK = `https://buy.stripe.com/test_kit_${run}`
const NORATE_LINK = `https://buy.stripe.com/test_norate_${run}`

// A stand-in for the Stripe API: the expanded session the webhook asks for.
function fakeStripe(paymentLinkUrl: string, promo: string | null = null): Stripe {
  return {
    checkout: {
      sessions: {
        retrieve: async () => ({
          line_items: { data: [{ description: 'High Score Host Launch Kit' }] },
          payment_link: { url: paymentLinkUrl },
          discounts: promo ? [{ promotion_code: { code: promo } }] : [],
        }),
        listLineItems: async () => ({ data: [] }),
      },
    },
  } as unknown as Stripe
}

function checkoutEvent(type: string, session: Partial<Stripe.Checkout.Session>): Stripe.Event {
  return { id: `evt_${Math.random()}`, type, data: { object: session } } as unknown as Stripe.Event
}

function session(id: string, repCode: string | null, extra: Partial<Stripe.Checkout.Session> = {}) {
  return {
    id,
    client_reference_id: repCode,
    amount_total: 99900,
    currency: 'usd',
    total_details: { amount_tax: 0, amount_discount: 0, amount_shipping: 0 },
    customer_details: { email: 'owner@bar.test', name: 'Corner Bar' },
    payment_intent: `pi_${id}`,
    payment_status: 'paid',
    ...extra,
  } as Partial<Stripe.Checkout.Session>
}

describe.skipIf(!enabled)('commissions end to end (local Supabase)', () => {
  let admin: SupabaseClient // service role: what the webhook uses
  let repClient: SupabaseClient
  let adminClient: SupabaseClient
  let repCode = ''
  let repId = ''
  let productId = ''

  async function signedIn(email: string): Promise<SupabaseClient> {
    const c = createClient(url!, anonKey!, { auth: { persistSession: false } })
    const { error } = await c.auth.signInWithPassword({ email, password: 'test-password-123' })
    if (error) throw error
    return c
  }

  async function sale(sessionId: string) {
    const { data, error } = await admin.from('sales').select('*').eq('stripe_session_id', sessionId)
    if (error) throw error
    return data
  }

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } })
    const repEmail = `rep-${run}@test.local`
    const adminEmail = `admin-${run}@test.local`
    for (const email of [repEmail, adminEmail]) {
      const { error } = await admin.auth.admin.createUser({
        email,
        password: 'test-password-123',
        email_confirm: true,
        user_metadata: { full_name: email.startsWith('rep') ? 'Test Rep' : 'Test Admin' },
      })
      if (error) throw error
    }
    const { data: profiles } = await admin.from('profiles').select('*').in('email', [repEmail, adminEmail])
    const repRow = profiles!.find((p) => p.email === repEmail)!
    repCode = repRow.rep_code
    repId = repRow.id
    await admin.from('profiles').update({ active: true }).eq('email', repEmail)
    await admin.from('profiles').update({ active: true, role: 'admin' }).eq('email', adminEmail)

    const { data: product } = await admin
      .from('products')
      .insert({
        name: `Launch Kit ${run}`,
        stripe_payment_link: LINK,
        price_cents: 99900,
        commission_type: 'percent',
        commission_value: 10,
      })
      .select()
      .single()
    productId = product!.id
    await admin.from('products').insert({ name: `No Rate ${run}`, stripe_payment_link: NORATE_LINK })

    repClient = await signedIn(repEmail)
    adminClient = await signedIn(adminEmail)
  })

  it('records a paid checkout with the product and 10% commission, once', async () => {
    const ev = checkoutEvent('checkout.session.completed', session(`cs_a_${run}`, repCode))
    const deps = { db: admin, stripe: fakeStripe(`${LINK}?client_reference_id=${repCode}`) }
    expect((await handleStripeEvent(ev, deps)).status).toBe(200)
    expect((await handleStripeEvent(ev, deps)).status).toBe(200) // Stripe redelivers
    const rows = await sale(`cs_a_${run}`)
    expect(rows).toHaveLength(1)
    expect(rows[0].product_id).toBe(productId)
    expect(rows[0].product_name).toBe('High Score Host Launch Kit')
    expect(rows[0].customer_name).toBe('Corner Bar')
    expect(rows[0].commission_cents).toBe(9990)
  })

  it('reduces the commission when the sale is partly refunded', async () => {
    const refund = { id: 'ch_1', payment_intent: `pi_cs_a_${run}`, amount_refunded: 49950 }
    const res = await handleStripeEvent(
      { id: 'evt_r', type: 'charge.refunded', data: { object: refund } } as unknown as Stripe.Event,
      { db: admin, stripe: null },
    )
    expect(res.status).toBe(200)
    expect((await sale(`cs_a_${run}`))[0].commission_cents).toBe(4995)
  })

  it('pays nothing until a bank payment clears, then pays', async () => {
    const id = `cs_b_${run}`
    const deps = { db: admin, stripe: fakeStripe(LINK) }
    await handleStripeEvent(checkoutEvent('checkout.session.completed', session(id, repCode, { payment_status: 'unpaid' })), deps)
    expect((await sale(id))[0].commission_cents).toBe(0)
    await handleStripeEvent(checkoutEvent('checkout.session.async_payment_succeeded', session(id, repCode)), deps)
    const [row] = await sale(id)
    expect(row.payment_status).toBe('paid')
    expect(row.commission_cents).toBe(9990)
  })

  it('a sale for a product with no rate earns nothing until the rate is set', async () => {
    const id = `cs_c_${run}`
    await handleStripeEvent(checkoutEvent('checkout.session.completed', session(id, repCode, { amount_total: 50000 })), {
      db: admin,
      stripe: fakeStripe(NORATE_LINK),
    })
    expect((await sale(id))[0].commission_cents).toBe(0)
    await adminClient
      .from('products')
      .update({ commission_type: 'flat', commission_value: 75 })
      .eq('stripe_payment_link', NORATE_LINK)
    expect((await sale(id))[0].commission_cents).toBe(7500)
  })

  it('accepts a correctly signed request through the real endpoint and rejects a bad one', async () => {
    const secret = 'whsec_local_test'
    process.env.STRIPE_WEBHOOK_SECRET = secret
    process.env.SUPABASE_URL = url
    process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey
    delete process.env.STRIPE_SECRET_KEY
    const payload = JSON.stringify(
      checkoutEvent('checkout.session.completed', session(`cs_d_${run}`, repCode, { amount_total: 10000 })),
    )
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret })
    const good = await POST(new Request('http://x/api/stripe-webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': header } }))
    expect(good.status).toBe(200)
    expect(await sale(`cs_d_${run}`)).toHaveLength(1) // no API key: recorded without a product
    const bad = await POST(new Request('http://x/api/stripe-webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': 't=1,v1=bad' } }))
    expect(bad.status).toBe(400)
  })

  it('shows a rep only their own money, and keeps them from changing it', async () => {
    const { data: mine } = await repClient.from('rep_earnings').select('*')
    expect(mine).toHaveLength(1)
    // 4995 (refunded sale) + 9990 (cleared bank payment) + 7500 (rate set later) + 0 (no product)
    expect(mine![0].earned_cents).toBe(22485)

    const { error: rateError } = await repClient
      .from('profiles')
      .update({ commission_type: 'percent', commission_value: 90 })
      .eq('id', repId)
    expect(rateError?.code).toBe('42501')

    const { error: insertError } = await repClient
      .from('sales')
      .insert({ rep_code: repCode, amount: 100000, source: 'manual', currency: 'usd' })
    expect(insertError).not.toBeNull()

    const { error: payoutError } = await repClient.from('payouts').insert({ rep_code: repCode, amount_cents: 100 })
    expect(payoutError).not.toBeNull()
  })

  it('lets an admin record a payout, add a manual sale and fix a commission', async () => {
    const { error: payErr } = await adminClient
      .from('payouts')
      .insert({ rep_code: repCode, amount_cents: 10000, paid_on: '2026-11-23', note: 'test' })
    expect(payErr).toBeNull()

    const { data: manual, error: manualErr } = await adminClient
      .from('sales')
      .insert({ rep_code: repCode, product_id: productId, amount: 99900, source: 'manual', currency: 'usd', payment_status: 'paid' })
      .select()
      .single()
    expect(manualErr).toBeNull()
    expect(manual!.commission_cents).toBe(9990)

    const { data: fixed } = await adminClient
      .from('sales')
      .update({ commission_override_cents: 12345 })
      .eq('id', manual!.id)
      .select()
      .single()
    expect(fixed!.commission_cents).toBe(12345)

    // Stripe sales can't be deleted, even by an admin.
    const { data: deleted } = await adminClient.from('sales').delete().eq('stripe_session_id', `cs_a_${run}`).select()
    expect(deleted).toHaveLength(0)

    const { data: mine } = await repClient.from('rep_earnings').select('*')
    expect(mine![0].paid_cents).toBe(10000)
    expect(mine![0].balance_cents).toBe(22485 + 12345 - 10000)
  })

  it('a rep-specific rate applies to that rep\'s new sales only', async () => {
    await adminClient.from('profiles').update({ commission_type: 'flat', commission_value: 200 }).eq('id', repId)
    const id = `cs_e_${run}`
    await handleStripeEvent(checkoutEvent('checkout.session.completed', session(id, repCode)), {
      db: admin,
      stripe: fakeStripe(LINK),
    })
    expect((await sale(id))[0].commission_cents).toBe(20000)
    expect((await sale(`cs_a_${run}`))[0].commission_cents).toBe(4995) // old sale keeps its rate
  })
})
