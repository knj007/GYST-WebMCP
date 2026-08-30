"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/database.types";
import { requireSupabasePublicConfig } from "@/lib/supabase/config";

export function createBrowserSupabaseClient() {
  const { publishableKey, url } = requireSupabasePublicConfig();

  return createBrowserClient<Database>(url, publishableKey);
}
