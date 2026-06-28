// Vercel Function (Web Handler signature — works for non-Next projects). Captures completed
// Stripe checkouts into the `sales` table, attributed by rep via `client_reference_id`.
//
// Endpoint: POST /api/stripe-webhook   (point your Stripe webhook here)
// Server-only env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY,
//                  SUPABASE_URL (or VITE_SUPABASE_URL). NEVER expose these to the client.
//
// Why this shape:
//  - `await request.text()` gives the RAW body — required for signature verification (parsing
//    and re-serializing would break the signature). No bodyParser config needed for Web handlers.
//  - `constructEventAsync` verifies the `stripe-signature` header using the webhook secret.
//  - Inserts use the Supabase SERVICE-ROLE client, which bypasses RLS (the only write path to sales).
//  - Idempotency: `sales.stripe_session_id` is UNIQUE; we upsert with ignoreDuplicates so Stripe's
//    repeat/concurrent deliveries never double-credit a rep.

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

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

  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('[stripe-webhook] missing required environment variables')
    return Response.json({ error: 'Server not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeSecret)

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

  // We only care about completed checkouts. Acknowledge everything else with 200.
  if (event.type !== 'checkout.session.completed') {
    return Response.json({ received: true, ignored: event.type })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // The line-item / product name is NOT on the event — fetch it (best-effort; never fail capture).
  let productName: string | null = null
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 })
    const names = lineItems.data.map((li) => li.description).filter(Boolean)
    productName = names.length > 0 ? names.join(', ') : null
  } catch (err) {
    console.warn('[stripe-webhook] could not fetch line items:', (err as Error).message)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const saleRow = {
    stripe_session_id: session.id,
    rep_code: session.client_reference_id ?? null,
    product_name: productName,
    amount: session.amount_total ?? null,
    currency: session.currency ?? null,
    customer_email: session.customer_details?.email ?? session.customer_email ?? null,
  }

  // Idempotent insert: ignore re-deliveries of the same session id (UNIQUE constraint).
  const { error } = await supabase
    .from('sales')
    .upsert(saleRow, { onConflict: 'stripe_session_id', ignoreDuplicates: true })

  if (error) {
    console.error('[stripe-webhook] failed to record sale:', error.message)
    // Return 500 so Stripe retries delivery.
    return Response.json({ error: 'Failed to record sale' }, { status: 500 })
  }

  if (!saleRow.rep_code) {
    console.warn(`[stripe-webhook] sale ${session.id} has no client_reference_id (unattributed)`)
  }

  return Response.json({ received: true })
}
