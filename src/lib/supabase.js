import { createClient } from '@supabase/supabase-js'

const supabaseUrl        = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey    = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

export const isConfigured =
  !!(supabaseUrl && supabaseAnonKey &&
     supabaseUrl !== 'https://your-project-id.supabase.co')

export { supabaseUrl, supabaseAnonKey }

// ── Auth client — login / logout / session management ───────────────────────
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false },
    })
  : null

// ── Query client — anon-only, NO token refresh, NO session persistence ───────
export const qdb = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession:    false,
        autoRefreshToken:  false,
        detectSessionInUrl: false,
      },
    })
  : null

// ── Admin client — service role key, bypasses rate limits for bulk user create
export const adminDb = (isConfigured && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken:  false,
        persistSession:    false,
        detectSessionInUrl: false,
      },
    })
  : null
