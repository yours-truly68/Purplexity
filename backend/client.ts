import { createClient } from '@supabase/supabase-js'
import dotenv from "dotenv"

dotenv.config()

export function createSupabaseClient() {
  return createClient(
     "https://dlaisdtcalgboipnowgk.supabase.co",
     process.env.SUPABASE_SECRET_KEY!
  )
}
