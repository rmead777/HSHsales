// Hand-maintained types mirroring the Supabase schema (supabase/migrations/0001_init.sql).
// If you later wire up the Supabase CLI, replace this with generated types via
// `supabase gen types typescript`.
//
// NOTE: these MUST be `type` aliases, not `interface`s. supabase-js requires each table's Row to
// be assignable to Record<string, unknown>, and TS only gives object *types* (not interfaces) an
// implicit index signature. With interfaces, Insert/Update silently degrade to `never`.

export type Role = 'rep' | 'admin'

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  active: boolean
  rep_code: string
  created_at: string
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
}

export type Announcement = {
  id: string
  body: string
  active: boolean
  created_at: string
}

export type Sale = {
  id: string
  stripe_session_id: string
  rep_code: string | null
  product_name: string | null
  amount: number | null // cents
  currency: string | null
  customer_email: string | null
  created_at: string
}

// Minimal PostgREST-shaped Database type so `createClient<Database>()` yields typed queries.
type Insertable<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Insertable<Profile, 'created_at'>
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
          'id' | 'active' | 'sort_order' | 'description' | 'image_url' | 'price_display'
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
        Insert: Insertable<Sale, 'id' | 'created_at'>
        Update: Partial<Sale>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
