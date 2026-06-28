# High Score Host — Sales App

Mobile-first **installable PWA** that lets a salesperson log in, receive their **personally
attributed** Stripe checkout links + QR codes, and send buyers to checkout — with every sale
auto-tagged to that rep. The app is a **thin launcher**: it stores *URLs that point to* sales
content (decks, pricing, videos), never the content itself.

Full build brief: [HSH_Sales_App_ClaudeCode_Spec.md](HSH_Sales_App_ClaudeCode_Spec.md).
Verified integration details: [docs/INTEGRATION_REFERENCE.md](docs/INTEGRATION_REFERENCE.md).

## Key Commands
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview prod build: `npm run preview`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`

## Stack
- **Frontend:** React + Vite + TypeScript, Tailwind CSS, mobile-first. PWA via `vite-plugin-pwa`.
- **Auth/DB:** Supabase (Postgres + Auth + RLS). Project ref: `cehlthclgguknjimimnw`.
- **Payments:** Stripe **Payment Links** (admin-pasted) + a **Vercel API route** webhook for capture.
- **QR codes:** generated client-side (`qrcode.react`). Never stored — derived from the URL.
- **Hosting:** Vercel.

## Architecture (how it fits together)
- `src/lib/supabaseClient.ts` — the browser Supabase client (anon/publishable key only).
  `src/lib/queries.ts` — all typed data access. `src/lib/attribution.ts` — the attributed-URL builder.
- `src/context/AuthContext.tsx` — session + current user's `profiles` row; refetches gated config
  on mount and on window focus.
- `src/pages/` — `Login`, `PendingActivation`, `Dashboard`, `Checkout`, `QRCodes`, `Admin/*`.
- `api/stripe-webhook.ts` — Vercel serverless route; verifies Stripe signature, writes `sales`
  using the **service-role** key (server-only).
- `supabase/migrations/` — schema, RLS policies, helper functions, signup trigger, seed.

## The two ideas you MUST get right
1. **Attribution.** One Stripe Payment Link per product (`products.stripe_payment_link`). At render
   time append `?client_reference_id={rep_code}` (use `&` if the URL already has `?`). That value
   rides into the Checkout Session and the `checkout.session.completed` webhook. **Never** mint a
   link per rep. `rep_code` is **alphanumeric only** (Stripe rejects most special chars).
2. **The activation gate is RLS, not app logic.** `links`/`products`/`announcements` are
   `SELECT`-able only when the requesting profile has `active = true`. An inactive rep gets **zero
   rows** — that *is* the gate. Frontend "pending" UI is cosmetic; the real enforcement is in Postgres.

## Code Conventions
- TypeScript strict. Functional components + hooks. No class components.
- Tailwind utility classes; keep design tokens consistent, mobile-first (`sm:`/`md:` to scale up).
- Data access goes through typed helpers in `src/lib/`; components don't call `supabase` ad hoc.
- Env: client vars are `VITE_*` only. **Never** put `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
  or `STRIPE_WEBHOOK_SECRET` in any `VITE_*` var or client bundle — server (api/) only.

## Common Pitfalls
- **RLS recursion:** a policy on `links` that queries `profiles`, plus policies on `profiles`,
  can recurse. Use `SECURITY DEFINER` helper functions (`private.is_active()`, `private.is_admin()`,
  in the unexposed `private` schema) that bypass RLS — do not inline `profiles` sub-selects in gated policies.
- **Privilege escalation:** a rep must not be able to set their own `active=true` or `role='admin'`.
  Enforced by the `enforce_profile_protected_columns` BEFORE UPDATE trigger. It only polices
  *end-users* (`auth.uid() IS NOT NULL`); SQL editor / service-role (null uid) are allowed — that's
  how the first admin is bootstrapped (migration `0003`). Plain `update … set role='admin'` from the
  SQL editor fails with `42501` only if `0003` hasn't been applied.
- **Webhook raw body:** Stripe signature verification needs the **raw** request body. The webhook is a
  Vercel Web-handler (`export function POST(request: Request)`), so `await request.text()` gives the raw
  bytes — no `bodyParser` config (that's Pages-Router only). Verified via `constructEventAsync`.
- **Idempotency:** `sales.stripe_session_id` is unique; ignore duplicate webhook deliveries.
- **Supabase identity matters.** Project `cehlthclgguknjimimnw` ("HSHsales") is in org
  `xaalrpfnougqlhjudiam` = **"Supreme Robot, LLC"**. There are two Supabase user accounts for Ryan:
  the default `supabase login` / GitHub login resolves to the *thinner* one (orgs `Ryan` /
  `rmead777's Org` / `Fairlead General`) which gets **403** here; the **Supreme Robot** identity
  also has the org and full access. For CLI work authenticate as Supreme Robot via
  `supabase login --token <PAT-from-that-account>` (browser OAuth keeps landing on the wrong
  identity due to session stickiness). The **hosted MCP** (`.mcp.json`) is already OAuth-granted
  into that org — MCP reads verified; MCP **writes** (`apply_migration`/DDL) unverified, confirm on
  the first migration.

## What NOT to do (from the spec §9)
- Don't store decks/pricing/scripts/videos in the app or DB — only their URLs.
- No native app — PWA only. No per-rep Stripe links. No commission/payout logic in V1.
- Don't try to "secure" public Stripe links; gate the rep's *access to their attributed link* via RLS.
- Don't build the game/leaderboard — this app only links out to its demo.
