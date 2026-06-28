# Integration Reference (verified)

Decision-ready reference for the HSH Sales PWA (React + Vite + TS + Tailwind + Supabase + Stripe on Vercel). Synthesized from four research lanes. Copy-pasteable.

---

## 1. Confirmed versions

| Package / surface | Version (June 2026) | Notes / decision |
|---|---|---|
| Vite | **8.1.0** (default) / 7.3 (conservative fallback) | Rolldown-powered. Needs Node 20.19+ or 22.12+. `vite-plugin-pwa` supports both → Vite 8 is safe. |
| create-vite | 9.x | Scaffold: `npm create vite@latest hsh-sales -- --template react-ts` |
| React / react-dom | **19.2.7** / 19.2.x | Pin with `--save-exact`. |
| @types/react / @types/react-dom | 19.2.x | Pin exactly to React major or JSX/children type errors. |
| @vitejs/plugin-react | current major (pairs w/ Vite 8) | |
| TypeScript | ~5.9 (5.x) | Project-references tsconfig from template. |
| Tailwind CSS | **4.3** (NOT v3) | First-party `@tailwindcss/vite` plugin, no PostCSS, no config file. |
| @tailwindcss/vite | 4.3 | |
| vite-plugin-pwa | **1.3.0** | Supports Vite 3.1–8.x. |
| qrcode.react | **4.2.0** | `<QRCodeSVG>` + `<QRCodeCanvas>`. |
| @supabase/supabase-js | **v2.58.0** (v2 line) | |
| Supabase API key | **publishable** `sb_publishable_...` | New format GA. Legacy `anon` JWT still works during migration. Service key = `sb_secret_...` (server only). |
| PostgREST (Data API) | v12+ | |
| Postgres | 15 / 16 / 17 | RLS semantics stable across these. |
| stripe-node | **v19.1.0** | `constructEvent(payload, header, secret, tolerance?, cryptoProvider?, receivedAt?)`. |

---

## 2. Stripe attribution + webhook

### Attributed-URL builder rule
- Append `?client_reference_id=VALUE` to the Payment Link URL → propagates to the Checkout Session.
- **URL-param charset is enforced: `[A-Za-z0-9_-]` only, max 200 chars.** Anything else (`@ . : /` spaces) or over-length is **SILENTLY DROPPED** → `client_reference_id` arrives `null` with no error. Sanitize first.
- Use an internal rep id like `rep_4f9a2c`, never an email. UUIDs (with dashes) are fine.

```typescript
// Stripe Payment Link client_reference_id accepts ONLY [A-Za-z0-9_-], max 200 chars.
export function buildAttributedPaymentLink(paymentLinkUrl: string, repId: string): string {
  const safe = repId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200);
  const url = new URL(paymentLinkUrl);
  url.searchParams.set('client_reference_id', safe);
  // Optional: url.searchParams.set('prefilled_email', buyerEmail);
  return url.toString();
}
// → https://buy.stripe.com/abc123?client_reference_id=rep_4f9a2c
```

### Exact event field paths (`checkout.session.completed`)
`event.data.object` is a `Stripe.Checkout.Session`.

| Datum | Path | Type / note |
|---|---|---|
| Session id (idempotency key) | `event.data.object.id` | `cs_...` |
| Rep attribution | `event.data.object.client_reference_id` | `string \| null` |
| Sale amount | `event.data.object.amount_total` | integer, **minor units (cents)**, nullable → divide by 100 |
| Currency | `event.data.object.currency` | 3-letter lowercase, nullable |
| Buyer email | `event.data.object.customer_details.email` | reliably populated after completion |
| Buyer email (fallback) | `event.data.object.customer_email` | only set if pre-specified |
| Product name | **NOT on the event** | see below |

### Is `listLineItems` needed? — YES
The product / line-item **name is never on the event** (`line_items` is expandable, not included by default). Call separately:
```typescript
const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
  limit: 100, // paginated; default page size 10, max 100 — pass 100 / auto-paginate
  expand: ['data.price.product'],
});
const productNames = lineItems.data.map((li) => li.description); // e.g. 'T-shirt'
```

### Raw-body / signature handling on Vercel (App Router — recommended)
`constructEvent` needs the **exact raw bytes**. Do NOT use `req.json()` (re-serialization breaks the signature). Route handlers do NOT auto-parse → `await req.text()` gives the raw body (no `bodyParser:false` trick needed — that's Pages Router only).

```typescript
// app/api/stripe/webhook/route.ts
import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();                       // RAW — required for signature
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    return new NextResponse('Webhook signature verification failed', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Idempotency: dedupe on the session id BEFORE fulfilling.
    const firstTime = await recordSessionOnce(session.id);
    if (!firstTime) return NextResponse.json({ received: true, duplicate: true });

    const repId = session.client_reference_id;
    const amountTotal = session.amount_total;             // cents
    const currency = session.currency;
    const buyerEmail = session.customer_details?.email ?? session.customer_email ?? null;

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100, expand: ['data.price.product'],
    });
    const productNames = lineItems.data.map((li) => li.description);

    await recordSale({ repId, amountTotal, currency, buyerEmail, productNames, sessionId: session.id });
  }
  return NextResponse.json({ received: true });
}
```

> Pages Router fallback only: `export const config = { api: { bodyParser: false } }` + read raw via `micro` `buffer(req)` and `req.headers['stripe-signature']`.

### Idempotency approach
Stripe may deliver the same event **multiple times, concurrently**. Dedupe atomically on the **session id** with a UNIQUE constraint + `ON CONFLICT DO NOTHING`. Return 2xx fast even for duplicates.

```sql
CREATE TABLE processed_sessions (
  session_id   text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
```
```typescript
async function recordSessionOnce(sessionId: string): Promise<boolean> {
  const result = await db.query(
    `INSERT INTO processed_sessions (session_id) VALUES ($1)
     ON CONFLICT (session_id) DO NOTHING RETURNING session_id`,
    [sessionId],
  );
  return result.rowCount === 1; // true = first time; false = duplicate (no-op)
}
```
Alternatively put a UNIQUE constraint on `sales.session_id` and upsert with `ON CONFLICT (session_id) DO NOTHING` so a re-delivery never double-credits a rep.

---

## 3. Supabase schema, helpers + RLS

> Recursion fix decision: use **SECURITY DEFINER helpers reading `public.profiles`** (always fresh, instantly revocable). The JWT-claims alternative is faster but STALE until token refresh — rejected for active/role gating where immediate revocation matters.

### 3.1 SECURITY DEFINER helpers (in a non-exposed `private` schema)
Mandatory hardening on every one: `SET search_path = ''`, fully-qualify everything, mark `STABLE`, wrap calls in `(select ...)` inside policies (initPlan → ~99.9% faster on large tables). Keep `private` OUT of API > Exposed schemas.

```sql
create schema if not exists private;

create or replace function private.is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active = true
  );
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function private.is_active() from anon, authenticated;
revoke all on function private.is_admin()  from anon, authenticated;
```

### 3.2 profiles table + signup trigger (unique rep_code w/ collision retry)
Server forces `role='rep'`, `active=false` — never trust client metadata. UNIQUE constraint on `rep_code` is the real collision guard; the loop just retries.

```sql
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'rep' check (role in ('rep','admin')),
  active     boolean not null default false,
  rep_code   text not null unique,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- pgcrypto for gen_random_bytes: create extension if not exists pgcrypto with schema extensions;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_code text; v_attempts int := 0;
begin
  loop
    v_attempts := v_attempts + 1;
    v_code := upper(substr(translate(encode(extensions.gen_random_bytes(8),'base64'),'+/=','XYZ'),1,8));
    begin
      insert into public.profiles (id, email, full_name, role, active, rep_code)
      values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'rep', false, v_code);
      exit;
    exception when unique_violation then
      if v_attempts >= 8 then
        raise exception 'could not allocate unique rep_code after % attempts', v_attempts;
      end if;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();
```
> If this function raises, the whole signup transaction rolls back ("Database error saving new user"). Keep defensive; test end-to-end.

### 3.3 Gated-table policies (links / products / announcements)
Apply the same 4 policies per gated table (links shown). SELECT = any active profile; writes = admin only.

```sql
alter table public.links         enable row level security;
alter table public.products      enable row level security;
alter table public.announcements enable row level security;

create policy "gated_select_active" on public.links
  for select to authenticated using ( (select private.is_active()) );

create policy "gated_insert_admin" on public.links
  for insert to authenticated with check ( (select private.is_admin()) );

create policy "gated_update_admin" on public.links
  for update to authenticated
  using ( (select private.is_admin()) ) with check ( (select private.is_admin()) );

create policy "gated_delete_admin" on public.links
  for delete to authenticated using ( (select private.is_admin()) );
```

### 3.4 profiles policies + self-update protection (anti-escalation)
**Load-bearing detail:** an UPDATE policy `WITH CHECK` sees only NEW, never OLD — it CANNOT detect a changed `role`/`active`. Enforce immutable columns with a BEFORE UPDATE trigger.

```sql
create policy "profiles_select_self_or_admin" on public.profiles
  for select to authenticated
  using ( id = (select auth.uid()) or (select private.is_admin()) );

create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using ( id = (select auth.uid()) or (select private.is_admin()) )
  with check ( id = (select auth.uid()) or (select private.is_admin()) );
-- No INSERT policy (signup trigger only). No DELETE policy (cascades from auth.users).

create or replace function public.enforce_profile_protected_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select private.is_admin()) then return new; end if;     -- admins may change anything
  if new.active is distinct from old.active
     or new.role is distinct from old.role then
    raise exception 'not authorized to modify active or role' using errcode = '42501';
    -- friendlier alt: new.active := old.active; new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_cols on public.profiles;
create trigger trg_profiles_protect_cols
  before update on public.profiles for each row
  execute function public.enforce_profile_protected_columns();
```

### 3.5 sales policies (read-gated; inserts via service role only)
The **service_role key ALWAYS bypasses RLS** — server-side inserts need NO insert policy. Adding a `service_role` policy does nothing. Leave write paths policy-less (RLS-enabled + no matching policy = denied).

```sql
alter table public.sales enable row level security;

create policy "sales_select_admin" on public.sales
  for select to authenticated using ( (select private.is_admin()) );

-- OPTIONAL: a rep reads only their own rep_code's sales (OR-combined with admin select).
create policy "sales_select_own_rep" on public.sales
  for select to authenticated
  using ( rep_code = (select p.rep_code from public.profiles p where p.id = (select auth.uid())) );

-- NO insert/update/delete policies. Server inserts with the service-role (sb_secret_) client:
--   const admin = createClient(URL, SERVICE_ROLE_KEY) // server-only, never browser
--   await admin.from('sales').insert(...)             // bypasses RLS
```
> In SSR a user session can overwrite the Bearer header and make the "service" client run as the user → RLS errors. Use a dedicated server-only admin client with the service key as Bearer and NO user session. RLS is enforced from the Authorization header, not `apikey`. Never ship `sb_secret_...` to the browser.

> Tables made via SQL editor do NOT get RLS automatically — always `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on profiles, links, products, announcements, sales.

---

## 4. Frontend stack

### Tailwind v3 vs v4 → **v4** (no PostCSS, no config file)
- Use `@tailwindcss/vite` plugin (the PostCSS path is mutually exclusive — don't use both).
- CSS entry is one line: `@import "tailwindcss";` — NOT `@tailwind base/components/utilities`.
- No `tailwind.config.js`, no `postcss.config.js`. Config is CSS-first via `@theme {}`; content auto-detected. Dark mode via `@custom-variant`.

```css
/* src/index.css */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
@theme {
  --color-brand: #0f172a;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}
```

### Scaffold + install
```bash
npm create vite@latest hsh-sales -- --template react-ts
cd hsh-sales && npm install
npm install tailwindcss @tailwindcss/vite
npm install -D vite-plugin-pwa
npm install qrcode.react
npm install --save-exact react@^19.2 react-dom@^19.2
npm install -D --save-exact @types/react@^19.2 @types/react-dom@^19.2
```

### vite-plugin-pwa config
Installable PWA needs: HTTPS (localhost exempt), manifest w/ name/short_name + 192 & 512 icons + a 512 `purpose:'any maskable'`, `display:'standalone'`, `start_url`, registered SW. SW only built in `build`/`preview` unless `devOptions.enabled:true`.

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      // devOptions: { enabled: true }, // test PWA in `npm run dev`
      manifest: {
        name: 'HSH Sales', short_name: 'HSH', description: 'HSH Sales app',
        theme_color: '#0f172a', background_color: '#0f172a',
        display: 'standalone', start_url: '/', scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'] },
    }),
  ],
})
```
```typescript
// main.tsx — register SW
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })
```
> Add `"vite-plugin-pwa/client"` to tsconfig `types` so `virtual:pwa-register` type-checks. Generate real PNG icons into `/public` (e.g. `@vite-pwa/assets-generator`).

### QR library → **qrcode.react 4.2.0**
SVG for crisp on-screen; hidden Canvas for one-call PNG export (`canvas.toDataURL`). For SVG download, serialize with `XMLSerializer` into a Blob. Use a large export `size` (e.g. 512).

```tsx
import { useRef } from 'react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'

export function QrCard({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  function downloadPng() {
    const canvas = canvasRef.current; if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png'); a.download = 'qr.png'; a.click()
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <QRCodeSVG value={url} size={220} level="M" includeMargin />
      <QRCodeCanvas ref={canvasRef} value={url} size={512} className="hidden" />
      <button onClick={downloadPng} className="rounded-lg bg-slate-900 px-4 py-2 text-white">Download QR</button>
    </div>
  )
}
```

### Share / clipboard helper
Both need a secure context. `navigator.share()` needs a user gesture (call directly in the click handler) and rejects `AbortError` on cancel (treat as success). Web Share is often absent on desktop → clipboard fallback is essential.

```typescript
export async function shareOrCopy(data: { title?: string; text?: string; url: string }) {
  if (typeof navigator.share === 'function') {
    try {
      if (typeof navigator.canShare !== 'function' || navigator.canShare(data)) {
        await navigator.share(data); return 'shared' as const
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared' as const
    }
  }
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(data.url); return 'copied' as const } catch {}
  }
  return 'failed' as const
}
```

---

## 5. Auth (supabase-js v2)

### Key naming + client creation
- Use the **publishable key** (`sb_publishable_...`); legacy `anon` JWT still works during migration. `createClient` usage is identical — supabase-js auto-detects key type.
- Vite only exposes `VITE_`-prefixed vars via `import.meta.env` (NOT `process.env`). De-facto names: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (or `..._PUBLISHABLE_KEY`).
- **NEVER** put `sb_secret_...` / service_role in any `VITE_` var — Vite inlines them into public JS.
- Create exactly ONE module-level client (survives StrictMode double-mount).

```typescript
// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY // publishable or legacy anon
if (!url || !publishableKey) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    persistSession: true,       // default — localStorage
    autoRefreshToken: true,     // default
    detectSessionInUrl: true,   // default — REQUIRED for email-confirm/OAuth redirects
  },
})
```

### AuthContext pattern
`getSession()` on mount (fast, local) → subscribe with `onAuthStateChange` → `subscription.unsubscribe()` on cleanup. **Do NOT await DB calls inside the callback** (deadlocks the auth lock); defer with `setTimeout(fn, 0)`.

```typescript
// src/context/AuthContext.tsx (essentials)
useEffect(() => {
  supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
    setSession(s); setLoading(false)
    // defer DB work: setTimeout(() => void fetchProfile(), 0)
  })
  return () => subscription.unsubscribe()
}, [])

const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  })
  const needsConfirmation = !!data.user && !data.session
  const alreadyExists = !!data.user && (data.user.identities?.length ?? 0) === 0
  return { needsConfirmation, alreadyExists, error }
}
```

### Profile fetch + refetch-on-focus
RLS scopes `select().eq('id', user.id)` automatically. Use `.maybeSingle()` (returns `data:null` instead of throwing PGRST116 if the row isn't created yet). Refetch on mount, `window` focus, and `visibilitychange`.

```typescript
const fetchProfile = useCallback(async () => {
  if (!user) { setProfile(null); setLoading(false); return }
  const { data, error } = await supabase
    .from('profiles').select('id, role, active, rep_code, config')
    .eq('id', user.id).maybeSingle()
  if (!error) setProfile(data); setLoading(false)
}, [user])

useEffect(() => { void fetchProfile() }, [fetchProfile])
useEffect(() => {
  const onFocus = () => void fetchProfile()
  const onVis = () => { if (document.visibilityState === 'visible') void fetchProfile() }
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onVis)
  return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVis) }
}, [fetchProfile])
```

### Email-confirmation handling
`signUp` returns `{ data: { user, session }, error }`:
- **Confirm email ON:** `data.user` set, `data.session === null` → show "check your inbox". (`needsConfirmation`)
- **Confirm email OFF (dev):** `data.session` present, `SIGNED_IN` fires.
- **Existing user (enumeration protection):** no error; returned user has **empty `identities` array** (`data.user.identities.length === 0`) → "may already be registered". (`alreadyExists`)
- Skip verification in DEV: Dashboard → Authentication → Email → turn OFF "Confirm email" (self-hosted `GOTRUE_MAILER_AUTOCONFIRM=true`). Re-enable for prod.

```typescript
const { needsConfirmation, alreadyExists, error } = await signUp(email, password)
if (error)            return showError(error.message)
if (alreadyExists)    return showInfo('That email may already be registered. Try signing in.')
if (needsConfirmation) return showInfo(`Check ${email} to confirm, then sign in.`)
navigate('/dashboard') // confirm-email OFF: already signed in
```

---

## 6. Open decisions / risks (human to confirm)

1. **Vite 8 vs 7.3.** Doc defaults to Vite 8.1 (cutting-edge, +~15 MB install via Rolldown/lightningcss). If any plugin misbehaves, pin Vite 7.3 (still security-supported). `vite-plugin-pwa` 1.3.0 supports both. — *Pick one before scaffolding.*
2. **Webhook host: Vercel routing model.** Snippets assume **Next.js App Router on Vercel**. This project is scaffolded as **React + Vite (SPA)**, which has NO `app/api` routes. Decide where the Stripe webhook lives: a Next.js app, a Vercel **Function** (`api/` serverless function — confirm raw-body access there), or a **Supabase Edge Function**. The raw-body handling differs per host. — *Must resolve; the Vite SPA alone cannot host the webhook.*
3. **`processed_sessions` vs `sales.session_id` UNIQUE.** Two idempotency designs presented. Recommend a single source of truth: UNIQUE on `sales.session_id` + upsert `ON CONFLICT DO NOTHING` (one table, no double-credit). Confirm whether a separate `processed_sessions` ledger is also wanted.
4. **Sales DB access from the webhook.** Webhook idempotency snippet uses a generic `db.query` (pg) but the sales insert uses the Supabase **service-role client**. Standardize on one Postgres access path (Supabase service-role client recommended, since it also bypasses RLS for the insert).
5. **JWT-claims RLS not used.** Chose SECURITY DEFINER table-read helpers for instant revocation. Trade-off: a profile read per gated-table statement (mitigated by `STABLE` + initPlan). Confirm acceptable; revisit only if profiles reads become a hotspot.
6. **rep_code generator depends on `pgcrypto`** (`extensions.gen_random_bytes`). Confirm the extension is enabled (`create extension if not exists pgcrypto with schema extensions;`) or swap to `substr(md5(gen_random_uuid()::text),1,8)`.
7. **`emailRedirectTo` / `/auth/callback` route.** Requires a real callback route and `detectSessionInUrl:true` (default). Confirm the route exists, and that the redirect URL is allow-listed in Supabase Auth settings.
8. **Sales `rep_code` join key.** `sales_select_own_rep` matches on `rep_code`. Ensure the webhook writes the same `rep_code` (or maps `client_reference_id` → `rep_code`) into `sales`, and that `client_reference_id` actually carries `rep_code` (not the profile UUID). Decide the canonical attribution value embedded in Payment Links.
9. **Versions are research-reported, not lockfile-verified.** React 19.2.7, Vite 8.1.0, Tailwind 4.3, etc. are from June 2026 research. Verify against `npm view` at install time and commit a lockfile.
