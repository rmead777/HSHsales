// Vercel Function (Web Handler signature). Records Stripe checkouts in `sales`, credited to the
// rep in `client_reference_id`; the database works out each sale's commission (migration 0005).
//
// Endpoint: POST /api/stripe-webhook   (point the Stripe webhook here)
// Events:   checkout.session.completed               -> record the sale
//           checkout.session.async_payment_succeeded -> a bank payment cleared: mark paid
//           checkout.session.async_payment_failed    -> a bank payment failed: no commission
//           charge.refunded                          -> refunds reduce the commission
// Server-only env: STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL (or
//                  VITE_SUPABASE_URL). STRIPE_SECRET_KEY is optional: with it, the sale also gets
//                  its product, line-item names and discount code. NEVER expose these to the client.
//
// Why this shape:
//  - `await request.text()` gives the RAW body, which signature verification needs.
//  - Writes use the service-role key (bypasses RLS); this route is the only Stripe write path.
//  - Idempotent: `sales.stripe_session_id` is UNIQUE and refunds set an absolute amount, so
//    Stripe's repeat or out-of-order deliveries never double-credit a rep.
//  - Self-contained on purpose (no imports from src/): Vercel runs this file as its own ESM function.

import Stripe from 'stripe'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function env(name: string, ...fallbacks: string[]): string | undefined {
  for (const key of [name, ...fallbacks]) {
    const v = process.env[key]
    if (v) return v
  }
  return undefined
}

export async function POST(request: Request): Promise<Response> {
  const stripeSecret = env('STRIPE_SECRET_KEY')
  const webhookSecret = env('STRIPE_WEBHOOK_SECRET')
  const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('[stripe-webhook] missing required environment variables')
    return Response.json({ error: 'Server not configured' }, { status: 500 })
  }

  // Signature checks don't use the API key; the placeholder only satisfies the constructor.
  const stripe = new Stripe(stripeSecret ?? 'sk_unused')

  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', (err as Error).message)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const result = await handleStripeEvent(event, { db, stripe: stripeSecret ? stripe : null })
  return Response.json(result.body, { status: result.status })
}

// ─────────────────────────── event handling (exported for tests) ───────────────────────────

export interface WebhookDeps {
  db: SupabaseClient
  /** null = no API key: record the sale without product, line items or discount code. */
  stripe: Stripe | null
}

interface Result {
  status: number
  body: Record<string, unknown>
}

const ok = (body: Record<string, unknown> = {}): Result => ({ status: 200, body: { received: true, ...body } })
const fail = (message: string): Result => ({ status: 500, body: { error: message } })

export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<Result> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.async_payment_failed':
      return recordCheckout(event.data.object as Stripe.Checkout.Session, event.type, deps)
    case 'charge.refunded':
      return recordRefund(event.data.object as Stripe.Charge, deps)
    default:
      return ok({ ignored: event.type })
  }
}

type SaleStatus = 'paid' | 'unpaid' | 'failed' | 'no_payment_required'

function statusFor(session: Stripe.Checkout.Session, type: string): SaleStatus {
  if (type === 'checkout.session.async_payment_failed') return 'failed'
  if (type === 'checkout.session.async_payment_succeeded') return 'paid'
  if (session.payment_status === 'unpaid') return 'unpaid'
  if (session.payment_status === 'no_payment_required') return 'no_payment_required'
  return 'paid'
}

async function recordCheckout(
  session: Stripe.Checkout.Session,
  type: string,
  { db, stripe }: WebhookDeps,
): Promise<Result> {
  const status = statusFor(session, type)
  const details = await sessionDetails(session, stripe)

  const { data: products, error: productsError } = await db
    .from('products')
    .select('id, name, stripe_payment_link, promo_code')
  if (productsError) console.warn('[stripe-webhook] could not read products:', productsError.message)
  const product = matchProduct(products ?? [], details.paymentLinkUrl, details.promoCode)

  const repCode = session.client_reference_id?.trim() || null
  const paymentIntent =
    typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null)

  const row = {
    stripe_session_id: session.id,
    source: 'stripe' as const,
    rep_code: repCode,
    product_id: product?.id ?? null,
    product_name: details.lineItemNames ?? product?.name ?? null,
    amount: session.amount_total ?? null,
    amount_tax: session.total_details?.amount_tax ?? 0,
    currency: session.currency ?? null,
    customer_email: session.customer_details?.email ?? session.customer_email ?? null,
    customer_name: session.customer_details?.name ?? null,
    payment_intent: paymentIntent,
    payment_status: status,
    promo_code: details.promoCode,
  }

  if (type === 'checkout.session.completed') {
    // First delivery wins; a repeat (or a "completed" arriving after the bank payment cleared) is ignored.
    const { error } = await db.from('sales').upsert(row, { onConflict: 'stripe_session_id', ignoreDuplicates: true })
    if (error) {
      console.error('[stripe-webhook] failed to record sale:', error.message)
      return fail('Failed to record sale') // 500 -> Stripe retries
    }
    if (!repCode) console.warn(`[stripe-webhook] sale ${session.id} has no client_reference_id (no rep)`)
    return ok({ recorded: session.id })
  }

  // A bank payment settled or failed: update the sale, or record it if this arrived first.
  const { data: updated, error: updateError } = await db
    .from('sales')
    .update({ payment_status: status })
    .eq('stripe_session_id', session.id)
    .select('id')
  if (updateError) {
    console.error('[stripe-webhook] failed to update payment status:', updateError.message)
    return fail('Failed to update sale')
  }
  if (updated && updated.length > 0) return ok({ updated: session.id, payment_status: status })

  const { error: insertError } = await db.from('sales').upsert(row, { onConflict: 'stripe_session_id' })
  if (insertError) {
    console.error('[stripe-webhook] failed to record sale:', insertError.message)
    return fail('Failed to record sale')
  }
  return ok({ recorded: session.id, payment_status: status })
}

async function recordRefund(charge: Stripe.Charge, { db }: WebhookDeps): Promise<Result> {
  const paymentIntent =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : (charge.payment_intent?.id ?? null)
  if (!paymentIntent) return ok({ ignored: 'refund without a payment intent' })

  // Absolute total refunded so far, so repeat deliveries are harmless.
  const { data, error } = await db
    .from('sales')
    .update({ amount_refunded: charge.amount_refunded ?? 0 })
    .eq('payment_intent', paymentIntent)
    .select('id')
  if (error) {
    console.error('[stripe-webhook] failed to record refund:', error.message)
    return fail('Failed to record refund')
  }
  return ok({ refunded: paymentIntent, sales: data?.length ?? 0 })
}

// ─────────────────────────── Stripe lookups (best effort) ───────────────────────────

interface SessionDetails {
  lineItemNames: string | null
  paymentLinkUrl: string | null
  promoCode: string | null
}

async function sessionDetails(session: Stripe.Checkout.Session, stripe: Stripe | null): Promise<SessionDetails> {
  const none: SessionDetails = { lineItemNames: null, paymentLinkUrl: null, promoCode: null }
  if (!stripe) return none
  try {
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items', 'payment_link', 'discounts.promotion_code'],
    })
    const names = (full.line_items?.data ?? []).map((li) => li.description).filter(Boolean)
    const link = full.payment_link && typeof full.payment_link === 'object' ? full.payment_link.url : null
    const promo =
      (full.discounts ?? [])
        .map((d) => (d.promotion_code && typeof d.promotion_code === 'object' ? d.promotion_code.code : null))
        .find((c): c is string => !!c) ?? null
    return { lineItemNames: names.length ? names.join(', ') : null, paymentLinkUrl: link, promoCode: promo }
  } catch (err) {
    // A restricted key may lack Payment Link or promotion code access; fall back to line items only.
    console.warn('[stripe-webhook] could not expand session:', (err as Error).message)
    try {
      const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 })
      const names = items.data.map((li) => li.description).filter(Boolean)
      return { ...none, lineItemNames: names.length ? names.join(', ') : null }
    } catch {
      return none
    }
  }
}

// ─────────────────────────── product matching (pure; exported for tests) ───────────────────────────

export interface ProductLinkRow {
  id: string
  name: string
  stripe_payment_link: string
  promo_code: string | null
}

/** Compare Payment Links by host + path only (ignores query, hash, case, trailing slash). */
export function normalizePaymentLink(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    return `${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

/**
 * Which product a checkout was for: the product whose Payment Link matches. When several
 * products share one link (say, a discounted version), the discount code used decides.
 */
export function matchProduct(
  products: ProductLinkRow[],
  paymentLinkUrl: string | null,
  promoCode: string | null,
): ProductLinkRow | null {
  const target = normalizePaymentLink(paymentLinkUrl)
  if (!target) return null
  const candidates = products.filter((p) => normalizePaymentLink(p.stripe_payment_link) === target)
  if (candidates.length === 0) return null
  const promo = promoCode?.trim().toLowerCase()
  return (
    (promo ? candidates.find((p) => p.promo_code?.trim().toLowerCase() === promo) : undefined) ??
    candidates.find((p) => !p.promo_code?.trim()) ??
    candidates[0]
  )
}
