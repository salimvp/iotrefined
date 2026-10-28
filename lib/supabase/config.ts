/**
 * Shared Supabase credential resolution.
 *
 * Deliberately has no `"use client"` directive: the browser client, the MCP
 * route and any future server route all need the *same* answer to "are real
 * credentials present?", otherwise the UI could report live mode while the
 * server side silently serves nothing (or the reverse).
 *
 * Only publishable (anon) credentials live here. Access is constrained by Row
 * Level Security; the service-role key must never reach this module.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const hasPlaceholder = (v: string) =>
  v.length === 0 || v.includes("YOUR-PROJECT-REF") || v.includes("YOUR-PUBLIC");

/** True only when real credentials are present, so callers can fall back to demo mode. */
export const isSupabaseConfigured =
  /^https?:\/\//.test(SUPABASE_URL) && !hasPlaceholder(SUPABASE_URL) && !hasPlaceholder(SUPABASE_ANON_KEY);
