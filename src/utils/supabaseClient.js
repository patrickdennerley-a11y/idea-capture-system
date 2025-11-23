import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase Environment Variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 🛑 CRITICAL: Stop Supabase from handling the URL automatically.
    // We will handle it manually in AuthContext.
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  }
})

export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
