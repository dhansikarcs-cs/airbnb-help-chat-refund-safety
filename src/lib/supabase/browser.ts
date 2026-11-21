"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser client for the sign-in form only. Holds the anon key, never a secret. */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase public env vars are missing. See .env.example.");
  }
  return createBrowserClient(url, key);
}
