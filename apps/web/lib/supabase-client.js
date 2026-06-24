import { createClient } from "@supabase/supabase-js";

let client = null;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: true,
        },
      },
    );
  }
  return client;
}
