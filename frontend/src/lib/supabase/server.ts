import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

export function createClient(request: Request) {
  const headers = new Headers()

  const supabase = createServerClient(
    import.meta.env.BUN_PUBLIC_SUPABASE_URL! ?? "https://dlaisdtcalgboipnowgk.supabase.co",
    import.meta.env.BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY! ?? "sb_publishable_vZSEXS2mRi-DVjOJmUWPLA_3Rhc_xD0",
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('Cookie') ?? '') as {
            name: string
            value: string
          }[]
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            headers.append('Set-Cookie', serializeCookieHeader(name, value, options))
          )
        },
      },
    }
  )

  return { supabase, headers }
}
