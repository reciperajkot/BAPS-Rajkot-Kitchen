import { createClient } from '@supabase/supabase-js';

// અહીં તમારી Supabase ની સાચી લિંક અને કી નાખો
const supabaseUrl = "https://ooeecqioprwverlpdjqe.supabase.co";
const supabaseAnonKey = "sb_publishable_YCq42ydsSyNmSbK1qtLRmA_FVeuFbvu";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;