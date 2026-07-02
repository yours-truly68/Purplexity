import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient() {
  return createClient(
     "https://dlaisdtcalgboipnowgk.supabase.co",
     process.env.SUPABASE_SECRET_KEY!
  )
}
