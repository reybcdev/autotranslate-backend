import { createClient } from '@supabase/supabase-js'
import { config } from './index.js'

if (!config.supabase.url || !config.supabase.serviceKey) {
  console.warn('Warning: Supabase credentials not configured')
}

export const supabase = createClient(
  config.supabase.url || '',
  config.supabase.serviceKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
