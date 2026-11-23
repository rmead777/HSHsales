// Hand-maintained types mirroring the Supabase schema (supabase/migrations/0001_init.sql
// + 0005_commissions.sql). If you later wire up the Supabase CLI, replace this with generated
// types via `supabase gen types typescript`.
//
// NOTE: these MUST be `type` aliases, not `interface`s. supabase-js requires each table's Row to
// be assignable to Record<string, unknown>, and TS only gives object *types* (not interfaces) an
// implicit index signature. With interfaces, Insert/Update silently degrade to `never`.

export type Role = 'rep' | 'admin'

/** percent = value% of the sale; flat = value dollars per sale. */
export type CommissionType = 'percent' | 'flat'

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  active: boolean
  rep_code: string
  created_at: string
  /** Optional per-rep rate that overrides product rates. null = use product rates. */
  commission_type: CommissionType | null
  commission_value: number | null
}

export type Link = {
  id: string
  label: string
  url: string
  sort_order: number
  active: boolean
  icon: string | null
}

export type Product = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  price_display: string | null
  stripe_payment_link: string
  sort_order: number
  active: boolean
  /** What Stripe charges, in cents. Only used to show reps what they earn. */
  price_cents: number | null
  commission_type: CommissionType | null
  commission_value: number | null
  /** Optional Stripe promotion code filled in on every rep link. */
  promo_code: string | null
}

export type Announcement = {
  id: string
  body: string
  active: boolean
  created_at: string
}

export type SaleStatus = 'paid' | 'unpaid' | 'failed' | 'no_payment_required'

export type Sale = {
  id: string
  stripe_session_id: string | null
  source: 'stripe' | 'manual'
  rep_code: string | null
  product_id: string | null
  product_name: string | null
  amount: number | null // cents
  amount_tax: number // cents
  amount_refunded: number // cents
  currency: string | null
  customer_email: string | null
  customer_name: string | null
  payment_intent: string | null
  payment_status: SaleStatus
  promo_code: string | null
  note: string | null
  /** Rate captured when the sale was recorded (the rep's rate, else the product's). */
  commission_type: CommissionType | null
  commission_value: number | null
  /** Set by an admin to fix this sale's commission by hand. */
  commission_override_cents: number | null
  /** Computed by the database on every write. */
  commission_cents: number
  created_at: string
  updated_at: string
}

export type Payout = {
  id: string
  rep_code: string
  amount_cents: number
  paid_on: string // YYYY-MM-DD
  note: string | null
  created_by: string | null
  created_at: string
}

/** View `rep_earnings`: one row per person with sales, commission earned, paid out and owed. */
export type RepEarnings = {
  rep_id: string
  rep_code: string
  full_name: string | null
  email: string | null
  role: Role
  active: boolean
  sales_count: number
  revenue_cents: number
  earned_cents: number
  waiting_count: number
  paid_cents: number
  balance_cents: number
  last_sale_at: string | null
}

// Minimal PostgREST-shaped Database type so `createClient<Database>()` yields typed queries.
type Insertable<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Insertable<Profile, 'created_at' | 'commission_type' | 'commission_value'>
        Update: Partial<Profile>
        Relationships: []
      }
      links: {
        Row: Link
        Insert: Insertable<Link, 'id' | 'active' | 'sort_order' | 'icon'>
        Update: Partial<Link>
        Relationships: []
      }
      products: {
        Row: Product
        Insert: Insertable<
          Product,
          | 'id'
          | 'active'
          | 'sort_order'
          | 'description'
          | 'image_url'
          | 'price_display'
          | 'price_cents'
          | 'commission_type'
          | 'commission_value'
          | 'promo_code'
        >
        Update: Partial<Product>
        Relationships: []
      }
      announcements: {
        Row: Announcement
        Insert: Insertable<Announcement, 'id' | 'active' | 'created_at'>
        Update: Partial<Announcement>
        Relationships: []
      }
      sales: {
        Row: Sale
        Insert: Insertable<
          Sale,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'stripe_session_id'
          | 'source'
          | 'product_id'
          | 'amount_tax'
          | 'amount_refunded'
          | 'customer_name'
          | 'payment_intent'
          | 'payment_status'
          | 'promo_code'
          | 'note'
          | 'commission_type'
          | 'commission_value'
          | 'commission_override_cents'
          | 'commission_cents'
        >
        Update: Partial<Sale>
        Relationships: []
      }
      payouts: {
        Row: Payout
        Insert: Insertable<Payout, 'id' | 'paid_on' | 'note' | 'created_by' | 'created_at'>
        Update: Partial<Payout>
        Relationships: []
      }
    }
    Views: {
      rep_earnings: {
        Row: RepEarnings
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
