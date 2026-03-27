import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Server-only Supabase client (lazy initialized).
 * No client-side usage — no anon key exposure.
 */
function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

// Convenience proxy: accessing any property on `supabase` forwards to the lazy client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Proxy requires broad type
export const supabase: SupabaseClient = new Proxy({} as any, {
  get(_, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic forwarding
    return (getSupabase() as any)[prop];
  },
});
