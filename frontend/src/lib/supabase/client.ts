import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
     "https://dlaisdtcalgboipnowgk.supabase.co",
     "sb_publishable_vZSEXS2mRi-DVjOJmUWPLA_3Rhc_xD0"
  )
}
