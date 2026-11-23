import { supabase } from './supabaseClient'
import type {
  Announcement,
  CommissionType,
  Link,
  Payout,
  Product,
  Profile,
  RepEarnings,
  Role,
  Sale,
} from './database.types'

// All access goes through these typed helpers; components never call `supabase`
// directly. Reads are RLS-gated server-side: an inactive rep simply gets zero rows.

// Rep-facing reads (active content only, ordered)

export async function fetchActiveLinks(): Promise<Link[]> {
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchActiveAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Admin: links

export async function fetchAllLinks(): Promise<Link[]> {
  const { data, error } = await supabase.from('links').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createLink(input: {
  label: string
  url: string
  sort_order: number
  active?: boolean
  icon?: string | null
}): Promise<Link> {
  const { data, error } = await supabase.from('links').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateLink(id: string, patch: Partial<Link>): Promise<void> {
  const { error } = await supabase.from('links').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteLink(id: string): Promise<void> {
  const { error } = await supabase.from('links').delete().eq('id', id)
  if (error) throw error
}

// Admin: products

export async function fetchAllProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createProduct(input: {
  name: string
  stripe_payment_link: string
  description?: string | null
  image_url?: string | null
  price_display?: string | null
  sort_order: number
  active?: boolean
}): Promise<Product> {
  const { data, error } = await supabase.from('products').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<void> {
  const { error } = await supabase.from('products').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

// Admin: announcements

export async function fetchAllAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createAnnouncement(input: { body: string; active?: boolean }): Promise<Announcement> {
  const { data, error } = await supabase.from('announcements').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateAnnouncement(id: string, patch: Partial<Announcement>): Promise<void> {
  const { error } = await supabase.from('announcements').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw error
}

// Admin: reps (profiles)

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Activate / deactivate a rep. Server-side, only admins pass the RLS + column-guard trigger. */
export async function setProfileActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('profiles').update({ active }).eq('id', id)
  if (error) throw error
}

export async function setProfileRole(id: string, role: Role): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
  if (error) throw error
}

// Sales (admin reporting; optional rep self-view)

export async function fetchSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchMySales(repCode: string): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('rep_code', repCode)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// Commissions (migration 0005)

/** The signed-in person's own balance row. Filtered by id because admins can read every row. */
export async function fetchMyEarnings(profileId: string): Promise<RepEarnings | null> {
  const { data, error } = await supabase.from('rep_earnings').select('*').eq('rep_id', profileId).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchMyPayouts(repCode: string): Promise<Payout[]> {
  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('rep_code', repCode)
    .order('paid_on', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Admin: every person's sales, earned, paid and owed. */
export async function fetchRepEarnings(): Promise<RepEarnings[]> {
  const { data, error } = await supabase
    .from('rep_earnings')
    .select('*')
    .order('revenue_cents', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchPayouts(): Promise<Payout[]> {
  const { data, error } = await supabase.from('payouts').select('*').order('paid_on', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createPayout(input: {
  rep_code: string
  amount_cents: number
  paid_on: string
  note: string | null
}): Promise<Payout> {
  const { data, error } = await supabase.from('payouts').insert(input).select().single()
  if (error) throw error
  return data
}

export async function deletePayout(id: string): Promise<void> {
  const { error } = await supabase.from('payouts').delete().eq('id', id)
  if (error) throw error
}

/** Admin edits to a sale. The database recomputes the commission. */
export async function updateSale(
  id: string,
  patch: Partial<Pick<Sale, 'rep_code' | 'product_id' | 'product_name' | 'commission_override_cents' | 'note'>>,
): Promise<Sale> {
  const { data, error } = await supabase.from('sales').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** Admin: a sale made outside the app's Stripe links (invoice, cash, the website). */
export async function createManualSale(input: {
  rep_code: string | null
  product_id: string | null
  product_name: string | null
  amount: number
  customer_name: string | null
  customer_email: string | null
  note: string | null
  created_at: string
}): Promise<Sale> {
  const { data, error } = await supabase
    .from('sales')
    .insert({ ...input, source: 'manual', currency: 'usd', payment_status: 'paid' })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Only manual sales can be deleted (RLS); Stripe sales are corrected instead. */
export async function deleteSale(id: string): Promise<void> {
  const { error } = await supabase.from('sales').delete().eq('id', id)
  if (error) throw error
}

export async function setProfileCommission(
  id: string,
  commission_type: CommissionType | null,
  commission_value: number | null,
): Promise<void> {
  const { error } = await supabase.from('profiles').update({ commission_type, commission_value }).eq('id', id)
  if (error) throw error
}
