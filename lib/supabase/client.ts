"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Public Supabase credentials.
 *
 * Only the publishable (anon) key belongs in the browser. Access is constrained
 * by Row Level Security. The service-role key must NEVER reach this file.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const hasPlaceholder = (v: string) =>
  v.length === 0 || v.includes("YOUR-PROJECT-REF") || v.includes("YOUR-PUBLIC");

/** True only when real credentials are present, so the app can fall back to demo mode. */
export const isSupabaseConfigured = /^https?:\/\//.test(url) && !hasPlaceholder(url) && !hasPlaceholder(anonKey);

let client: SupabaseClient | null = null;

/** Lazily create the singleton browser client. Returns null in demo mode. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
      auth: { persistSession: false },
    });
  }
  return client;
}
