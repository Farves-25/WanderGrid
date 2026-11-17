/**
 * Copy this file to `supabase.config.ts` (git-ignored) and fill in your values
 * from Supabase → Project Settings → API. Leave empty to hide the Google button.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
