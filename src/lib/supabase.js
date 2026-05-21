import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured =
  !!(supabaseUrl && supabaseAnonKey &&
     supabaseUrl !== 'https://your-project-id.supabase.co')

export { supabaseUrl, supabaseAnonKey }

// ── Auth client — login / logout / session management ───────────────────────
// autoRefreshToken:false  → prevents the "refresh token" network request that
// hangs on Vercel, which blocked getSession() and signOut() via session lock.
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false },
    })
  : null

// ── Query client — anon-only, NO token refresh, NO session persistence ───────
// Bypasses the JWT auto-refresh that can hang on slow / first-load requests.
// Safe because all RLS policies use `using (true)` (allow all roles).
export const qdb = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession:    false,
        autoRefreshToken:  false,
        detectSessionInUrl: false,
      },
    })
  : null
