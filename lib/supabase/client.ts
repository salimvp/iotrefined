"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Browser Supabase client.
 *
 * Credential resolution lives in `./config` so the server-side MCP route and
 * this client can never disagree about whether the app is configured.
 */

export { isSupabaseConfigured };

let client: SupabaseClient | null = null;

/** Lazily create the singleton browser client. Returns null in demo mode. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } },
      auth: { persistSession: false },
    });
  }
  return client;
}
