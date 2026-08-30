import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/db/database.types";
import { requireSupabasePublicConfig } from "@/lib/supabase/config";

export async function createServerSupabaseClient() {
  const { publishableKey, url } = requireSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot emit Set-Cookie. Proxy refreshes the
          // session before render; Server Actions and Route Handlers can write.
        }
      },
    },
  });
}
