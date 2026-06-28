# Claude Code Build Spec — High Score Host Sales App (V3)

> Paste this into Claude Code as the build brief, or drop it in the repo as `SPEC.md`.
> It is written for an agent to execute, so it favors explicit acceptance criteria over prose.

---

## 1. Mission

Build a **mobile-first web app (installable PWA)** that lets a salesperson, anywhere in the
world, log in, receive their **personal attributed** sales links + QR codes, and send buyers
to Stripe checkout — with **every sale automatically tagged to that salesperson**, with zero
per-rep setup.

The app is a **thin launcher**. Its only real jobs are:

1. Authenticate reps and gate them behind admin activation.
2. Generate each rep's attributed Stripe checkout URL + QR codes.
3. Capture completed sales (tagged by rep) into our own database.
4. Serve an **admin-editable list of buttons** that mostly just redirect to external
   Google Docs / Slides / Sheets / YouTube / hosted pages.

**No sales content (decks, pricing, scripts, FAQs, videos) is stored in the app or DB —
only the URLs that point to it.** Pricing and scripts change constantly; they must be
editable without shipping a new build.

---

## 2. Non-negotiable principles

- **Do as little as possible.** Anything that changes frequently lives *outside* the app as a URL.
- **No native app.** Responsive web + PWA (home-screen installable). No app-store releases, ever.
- **One Stripe link per product**, attributed per-rep via a URL parameter (see §6). Never mint a
  link per rep per product.
- **You cannot "secure" a public Stripe link** — they are meant to be public. The thing you gate
  is a rep's ability to *fetch their attributed link* (via RLS), not the link itself.
- **The admin panel should feel like editing bookmarks.** Label + URL. No coding to update content.
- **Build the data pipe before the UI.** Capture sales from day one even if the rep-facing
  dashboard ships later — so there is nothing to backfill.

---

## 3. Stack

- **Frontend:** React + Vite, TypeScript. Mobile-first. Tailwind CSS. PWA manifest + service worker.
- **Auth / DB:** Supabase (Postgres + Auth + Row Level Security).
- **Hosting:** Vercel.
- **Payments:** Stripe **Payment Links** (admin-pasted) + a Stripe **webhook** for sale capture.
- **QR codes:** generated **client-side** (e.g. `qrcode.react` or equivalent) from each rep's
  attributed URLs. **Do not store QR images** — they are derived from the URL.

> If the existing High Score codebase uses a different stack, swap the auth/DB layer only;
> the architecture in this spec is stack-agnostic.

---

## 4. Data model (Supabase / Postgres)

Create these tables. All `id` are UUIDs unless noted.

**`profiles`** (1:1 with `auth.users`)
| column | type | notes |
|---|---|---|
| id | uuid (PK, = auth.users.id) | |
| email | text | |
| full_name | text | |
| role | text | `'rep'` \| `'admin'`, default `'rep'` |
| active | bool | default `false` — admin must flip to `true` |
| rep_code | text (unique) | **alphanumeric only**, short (6–8 chars). Used for attribution. |
| created_at | timestamptz | default now() |

**`links`** (the dashboard buttons / bookmarks)
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| label | text | e.g. "Sales Deck" |
| url | text | external destination |
| sort_order | int | for ordering |
| active | bool | default true |
| icon | text (nullable) | optional icon name |

**`products`** (checkout items)
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| name | text | e.g. "1,000 Interactive Coasters" |
| description | text | |
| image_url | text (nullable) | |
| price_display | text | human label, e.g. "$1,000 (lifetime license + swag)" — **display only**, not authoritative |
| stripe_payment_link | text | the **base** Stripe Payment Link URL (one per product) |
| sort_order | int | |
| active | bool | default true |

**`announcements`**
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| body | text | |
| active | bool | default true |
| created_at | timestamptz | default now() |

**`sales`** (attribution ledger — written by the Stripe webhook)
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| stripe_session_id | text (unique) | idempotency key |
| rep_code | text | from `client_reference_id` on the session |
| product_name | text (nullable) | |
| amount | int | in cents |
| currency | text | |
| customer_email | text (nullable) | |
| created_at | timestamptz | default now() |

### Row Level Security (the activation gate lives here)
- `profiles`: a user can `SELECT`/`UPDATE` **their own** row; admins can `SELECT`/`UPDATE` all.
  Only admins may change `active` and `role`.
- `links`, `products`, `announcements`: **`SELECT` allowed only for active reps and admins**
  (`active = true` on the requesting profile). Only admins may `INSERT`/`UPDATE`/`DELETE`.
  → An inactive rep gets **zero rows**, so they see no buttons and no checkout — this *is* the gate.
- `sales`: `SELECT` for admins. (A rep "my sales" view, if built, lets a rep `SELECT` only
  rows where `rep_code` = their own.) Inserts come from the server (service role) only.

---

## 5. Features & acceptance criteria

### 5.1 Auth + activation
- Email/password signup and login via Supabase Auth.
- On signup, create a `profiles` row with `active=false`, `role='rep'`, and a generated unique
  `rep_code` (alphanumeric).
- If `active=false`, the app shows a **"Account pending activation"** state and fetches no gated data.
- Admin flips `active=true` (see §5.5) → rep gains access on next load.

### 5.2 Dashboard
- **Buttons only.** Render `links` ordered by `sort_order`, active only.
- Each button opens its `url` (new tab/in-app browser). Examples the admin will populate:
  Sales Deck, Pricing, Product Info, Videos, Launch Kits, Checkout, Announcements, Training, Help.
- Show the latest active announcement(s) somewhere visible.

### 5.3 Checkout (most important screen)
- Render `products` (active, ordered). For each product show: name, description, image,
  `price_display`, and the rep's actions:
  - **Copy Link** — copies the rep's attributed checkout URL (see §6).
  - **Share Link** — native share sheet with the same URL.
  - **QR Code** — renders a QR encoding the same URL.

### 5.4 QR codes
- A dedicated view with three QR codes for the **logged-in rep**, each carrying their `rep_code`:
  - **Demo** → the live demo / game page, e.g. `{DEMO_URL}?ref={rep_code}` (top of funnel).
  - **Customer Purchase** → the product's Stripe link with `client_reference_id={rep_code}` (in-person, scan-now).
  - **Personal Referral** → a shareable link for prospects who aren't physically present.
    *(Default: same Stripe checkout URL as Customer Purchase, surfaced as a copyable link rather
    than a show-this QR. Confirm with the owner whether Referral should instead point to the
    landing page — trivial to switch.)*

### 5.5 Admin CMS (feels like editing bookmarks)
- CRUD on `links`, `products`, `announcements`.
- Edit button **names, order, and destination URLs**; edit product **Stripe links, names,
  descriptions, images, prices**.
- Toggle `active` on any `profiles` row (activate/deactivate reps).
- Changes are visible to reps on reload. *(Realtime push is optional — see §9.)*

---

## 6. Sale attribution — the core mechanism (get this exactly right)

- Each rep has a unique `rep_code` — **alphanumeric only** (Stripe's `client_reference_id`
  rejects most special characters).
- Admin stores **one** Stripe Payment Link per product in `products.stripe_payment_link`.
  **Do not** generate a link per rep per product.
- At render time, build the rep's checkout URL by appending the reference parameter to the base link:

  ```
  {stripe_payment_link}?client_reference_id={rep_code}
  ```

  - If the base link already contains `?`, append with `&` instead.
  - **Verify the exact parameter name/behavior against current Stripe Payment Links docs.**
    `client_reference_id` is the intended primitive: it propagates to the resulting Checkout
    Session and to the `checkout.session.completed` webhook. If it is unavailable for the link
    type in use, fall back to passing it as session metadata.
- The **Customer Purchase** QR and the checkout **Copy/Share Link** all encode this same per-rep URL.
- **Net effect:** any buyer who scans a rep's QR or opens a rep's link and pays is tagged to that
  rep — with zero per-rep configuration.

---

## 7. Sale capture (V1 infrastructure; powers reporting + future rep dashboard)

- Implement a **Stripe webhook** (Supabase Edge Function or Vercel API route) listening for
  `checkout.session.completed`.
- **Verify the Stripe signature** using `STRIPE_WEBHOOK_SECRET`.
- Read `client_reference_id`, amount, currency, customer email, line-item/product name, and
  session id. Write a row to `sales` using the Supabase **service role** key (server-side only).
- Use `stripe_session_id` as a unique idempotency key (ignore duplicate deliveries).
- The rep-facing "my sales / my earnings" view is **optional for V1**, but the `sales` table must
  exist and capture from day one so we never have to backfill.

---

## 8. Build order

1. **Supabase:** schema + RLS. Manually seed one admin (`role='admin', active=true`).
2. **Auth:** signup/login; on signup create the `profiles` row (`active=false`, `role='rep'`, gen `rep_code`).
3. **Activation gate:** app shell with a "pending activation" state; gated data fetches honor RLS.
4. **Dashboard:** render `links` (ordered, active); buttons open URLs; show announcements.
5. **Checkout:** render `products`; per product → Copy / Share / QR using the per-rep attributed URL (§6).
6. **QR view:** Demo / Customer Purchase / Personal Referral for the logged-in rep.
7. **Admin CMS:** CRUD links/products/announcements; toggle rep `active`; reorder.
8. **Stripe webhook → `sales` capture** (§7).
9. **PWA:** manifest, icons, service worker, installability.
10. **(Optional)** Rep "my sales" view reading `sales` filtered by their own `rep_code`.

---

## 9. What NOT to do

- Don't store decks, pricing, scripts, FAQs, or videos in the app or DB — **only their URLs**.
- Don't build native iOS/Android. PWA only.
- Don't create per-rep Stripe links. **One link per product**, attribute via URL param.
- Don't try to "secure" public Stripe links — gate the rep's *access to their attributed link* via RLS.
- Don't build commission/payout logic in V1 — the `sales` table is the hook for it later.
- Don't build the game/leaderboard or its "world clock / countdown" — that is a **separate product**;
  this app only links out to its demo.
- Don't over-engineer sync — fetching config on load + on window focus is enough. Realtime is optional.

---

## 10. Environment variables

- **Client:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Server (webhook):** `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_WEBHOOK_SECRET`
  (and `STRIPE_SECRET_KEY` if querying Stripe directly)
- **Never** expose the service role key or any Stripe secret to the client bundle.

---

## 11. Seed data (placeholders — clearly marked for the admin to replace)

- One admin `profiles` row (the owner).
- 2–3 `links`: e.g. "Sales Deck" → Google Slides placeholder, "Pricing" → Google Sheet placeholder,
  "Training" → Google Doc placeholder.
- 1–2 `products` with placeholder Stripe Payment Link URLs, e.g.
  - "1,000 Interactive Coasters" — `$1,000 (lifetime license + swag)`
  - "Subscription" — `$300`
- Mark all of the above as **placeholder — replace via admin**.

---

## 12. Definition of done

- A new rep can sign up, sees a "pending" state, and is activated by an admin.
- An active rep sees the dashboard buttons and the checkout products; an inactive rep — even with a
  direct link to the app — gets **no** product/link data (RLS-enforced).
- Each product shows a working **per-rep** Stripe link + copyable/shareable URL + scannable QR that
  carries the rep's `rep_code`.
- A test purchase puts the rep's `rep_code` on the Stripe Checkout Session **and** lands a row in `sales`.
- Admin can rename / reorder / add / remove buttons and products, post an announcement, and
  activate/deactivate reps — all visible on reload.
- Installs as a PWA on a phone home screen.
