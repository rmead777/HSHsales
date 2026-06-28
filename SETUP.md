# Setup — High Score Host Sales App

End-to-end setup for local dev → Supabase → Stripe → Vercel. Follow top to bottom.

> Stack: React + Vite + TypeScript + Tailwind v4 + `motion`, Supabase (Auth/Postgres/RLS),
> Stripe Payment Links + a Vercel webhook, deployed on Vercel as an installable PWA.

---

## 0. Prerequisites
- **Node 20.19+ or 22.12+** (Vite 8 requirement). Check: `node -v`.
- A Supabase project (this app targets `cehlthclgguknjimimnw`).
- A Stripe account.
- A Vercel account (for deploy + the webhook).

## 1. Install & run locally
```bash
npm install
cp .env.example .env     # then fill in values (see §3)
npm run dev              # http://localhost:5173
```
Other scripts: `npm run build` (typecheck + prod build), `npm run preview`, `npm run typecheck`, `npm run lint`.

---

## 2. Supabase — database & auth

### 2a. Apply the schema (RLS, triggers, seed)
This Claude session's Supabase MCP is logged into a different account than the one that owns
`cehlthclgguknjimimnw`, so migrations are applied **manually**:

1. Open the project's **SQL Editor**: <https://supabase.com/dashboard/project/cehlthclgguknjimimnw/sql>
2. Paste & run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — schema, RLS,
   helper functions, the signup trigger, and the anti-escalation trigger.
3. Paste & run [`supabase/migrations/0002_seed.sql`](supabase/migrations/0002_seed.sql) — placeholder
   links/products/announcements (idempotent; only seeds empty tables).

> If you later restart Claude Code with the Supabase connector authed to the owning account, the MCP
> can apply these for you instead (`apply_migration`). Or use the CLI if it's linked to this project.

### 2b. Keep the `private` schema unexposed
Dashboard → **Project Settings → API → Exposed schemas**: ensure it lists `public` (and `graphql_public`)
but **NOT `private`**. The `private.is_active()` / `private.is_admin()` helpers must not be callable as RPCs.

### 2c. Auth settings
Dashboard → **Authentication → URL Configuration**:
- **Site URL**: your production origin (e.g. `https://your-app.vercel.app`).
- **Redirect URLs**: add `http://localhost:5173/auth/callback` and `https://your-app.vercel.app/auth/callback`.

Dashboard → **Authentication → Providers → Email**:
- For password signup **without** an email round-trip during testing, turn **Confirm email OFF**.
  Leave it ON for production (the app already handles the "check your inbox" flow).

### 2d. Make yourself an admin
1. Run the app, **sign up** with your email → you'll see "Account pending".
2. In the SQL editor:
   ```sql
   update public.profiles set role = 'admin', active = true where email = 'rmead777@gmail.com';
   ```
3. Reload the app — you now have the **Admin** tab.

---

## 3. Environment variables

### Local — `.env` (client, safe to ship)
```
VITE_SUPABASE_URL=https://cehlthclgguknjimimnw.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable / anon key from Project Settings → API keys>
VITE_DEMO_URL=https://your-demo-or-game-page   # optional; powers the "Demo" QR
```

### Vercel — server only (NEVER prefixed VITE_, never in the bundle)
Set these in Vercel → Project → **Settings → Environment Variables**:
```
SUPABASE_URL=https://cehlthclgguknjimimnw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role / sb_secret_ key — Project Settings → API keys>
STRIPE_SECRET_KEY=sk_live_...        # used to fetch line items for the product name
STRIPE_WEBHOOK_SECRET=whsec_...      # from the Stripe webhook you create in §4
```
Also add the two `VITE_*` client vars in Vercel so the production build picks them up.

> ⚠️ Never put the service-role key or any Stripe secret in a `VITE_*` var — Vite inlines those into
> the public JS bundle.

---

## 4. Stripe

### 4a. Payment Links (one per product)
1. Stripe Dashboard → **Payment Links** → create one link per product.
2. In the app's **Admin → Products**, paste each base link (e.g. `https://buy.stripe.com/abc123`).
   The app appends `?client_reference_id={rep_code}` per rep automatically — **do not** make per-rep links.

### 4b. Webhook → sale capture
1. Deploy the app to Vercel first (§5) so the endpoint exists.
2. Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
   - **URL**: `https://your-app.vercel.app/api/stripe-webhook`
   - **Events**: `checkout.session.completed`
3. Copy the **Signing secret** (`whsec_...`) → set `STRIPE_WEBHOOK_SECRET` in Vercel, then redeploy.
4. Test: Stripe → the webhook → **Send test event** (`checkout.session.completed`), or do a real
   test-mode purchase via a rep's link. Confirm a row lands in `public.sales` with the rep's `rep_code`,
   and that it shows in **Admin → Sales**.

---

## 5. Deploy to Vercel
```bash
npm i -g vercel        # if needed
vercel                 # link the project (framework auto-detected as Vite)
vercel --prod          # production deploy
```
`vercel.json` already sets the SPA fallback (so deep links work) while leaving `/api/*` to the function.
After the first deploy, finish §4b (webhook secret) and redeploy.

---

## 6. Install as a PWA
On a phone, open the deployed URL in the browser → **Add to Home Screen**. It launches standalone,
respects notches/safe areas, and auto-updates the service worker in the background.

---

## 7. End-to-end attribution test (the thing that must work)
1. Sign in as an **active** rep; note your `rep_code` (header chip / QR page).
2. **Checkout** → a product → **Copy** the link → confirm it ends with `?client_reference_id=<your code>`.
3. Pay via that link in Stripe **test mode**.
4. The webhook writes a `sales` row tagged with your `rep_code` → visible in **Admin → Sales**.
5. Sanity-check the gate: a **pending** (inactive) rep sees only the "Account pending" screen and, even
   with a direct API call, gets **zero** rows from links/products/announcements (RLS).

---

## Troubleshooting
- **"Missing Supabase env vars"** on load → `.env` not set or dev server not restarted after editing it.
- **Login works but no buttons/products** → your profile is `active = false` (still pending), or RLS/grants
  weren't applied. Re-run `0001_init.sql`.
- **Webhook 400 "Invalid signature"** → `STRIPE_WEBHOOK_SECRET` mismatch, or a proxy altered the raw body.
- **Sales row has `unattributed`** → the Payment Link was opened without `client_reference_id` (e.g. a raw
  base link), or the code contained characters Stripe dropped (only `[A-Za-z0-9_-]` survive).
- **Email confirmation loop in dev** → turn off "Confirm email" (§2c) or use the `/auth/callback` flow.
