# High Score Host — Sales App

A mobile-first, installable **PWA** that gives each salesperson their own **attributed** Stripe
checkout links + QR codes, so **every sale is automatically tagged to the rep** — with zero per-rep
setup. The app is a **thin launcher**: it stores the *URLs* that point to sales content (decks,
pricing, videos), never the content itself.

| | |
|---|---|
| **Stack** | React + Vite + TypeScript · Tailwind v4 · `motion` · Supabase (Auth/Postgres/RLS) · Stripe Payment Links · Vercel |
| **Design** | Light, layered, frosted-glass over a living aurora; spring-physics micro-interactions; color used as signal |
| **Run** | `npm install` → `npm run dev` |
| **Build** | `npm run build` (typecheck + Vite build) |

## How it works
- **Attribution** — one Stripe Payment Link per product; at render time the app appends
  `?client_reference_id={rep_code}`, which rides into the `checkout.session.completed` webhook.
- **Activation gate** — enforced by **Row-Level Security**: gated tables are readable only by profiles
  with `active = true`. An inactive rep gets *zero rows* — that *is* the gate.
- **Sale capture** — a Vercel webhook (`/api/stripe-webhook`) verifies the Stripe signature and writes
  the sale (tagged by `rep_code`) using the service-role key. Idempotent on `stripe_session_id`.

## Docs
- **[SETUP.md](SETUP.md)** — full setup: Supabase, Stripe, Vercel, env vars, end-to-end test.
- **[HSH_Sales_App_ClaudeCode_Spec.md](HSH_Sales_App_ClaudeCode_Spec.md)** — the build brief.
- **[docs/INTEGRATION_REFERENCE.md](docs/INTEGRATION_REFERENCE.md)** — verified integration details.
- **[CLAUDE.md](CLAUDE.md)** — architecture + conventions for future work.

## Project layout
```
api/stripe-webhook.ts        Vercel function: Stripe webhook → sales capture
src/lib/                     supabase client, typed queries, attribution, motion tokens, helpers
src/context/AuthContext.tsx  session + profile + activation state
src/components/              app shells, route guards, UI primitives (glass, motion)
src/pages/                   Login, Dashboard, Checkout, QRCodes, admin/*
supabase/migrations/         schema + RLS + triggers + seed (run in the SQL editor)
```
