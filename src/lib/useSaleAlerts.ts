import { useEffect } from 'react'
import { supabase } from './supabaseClient'
import { formatAmount } from './format'
import type { Sale } from './database.types'

/** Fired on window when a new sale arrives, so open pages can refresh. */
export const SALE_EVENT = 'hsh:new-sale'

/**
 * Live "New sale" alerts. Realtime applies the same row security as queries: a rep only
 * hears about their own sales; an admin hears about every sale.
 */
export function useSaleAlerts(
  enabled: boolean,
  isAdmin: boolean,
  show: (message: string, tone?: 'success' | 'info' | 'error') => void,
) {
  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('sale-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, (payload) => {
        const sale = payload.new as Sale
        const what = sale.product_name ?? 'a sale'
        if (isAdmin) {
          const who = sale.rep_code ? ` by ${sale.rep_code}` : ' (no rep)'
          show(`New sale${who}: ${what}, ${formatAmount(sale.amount, sale.currency)}`, 'success')
        } else if (sale.commission_cents > 0) {
          show(`New sale: ${what}. You earned ${formatAmount(sale.commission_cents, 'usd')}`, 'success')
        } else {
          show(`New sale: ${what}`, 'success')
        }
        window.dispatchEvent(new Event(SALE_EVENT))
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, isAdmin, show])
}
