import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY // publishable (sb_publishable_...) or legacy anon

if (!url || !publishableKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example).',
  )
}

// Exactly one module-level client (survives React StrictMode's double-mount in dev).
export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // required for the email-confirmation / magic-link callback
  },
})
