import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/db/database.types";
import { readSupabasePublicConfig } from "@/lib/supabase/config";

const protectedPrefixes = ["/daily", "/weekly"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function copySessionResponse(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));

  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(name);

    if (value) {
      target.headers.set(name, value);
    }
  }

  return target;
}

function loginRedirect(request: NextRequest, reason?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";

  if (reason) {
    url.searchParams.set("reason", reason);
  }

  return NextResponse.redirect(url);
}

export async function updateSupabaseSession(request: NextRequest) {
  const config = readSupabasePublicConfig();

  if (!config) {
    return isProtectedPath(request.nextUrl.pathname)
      ? loginRedirect(request, "configuration")
      : NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, options, value }) => {
          supabaseResponse.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([name, value]) => {
          supabaseResponse.headers.set(name, value);
        });
      },
    },
  });

  // Keep this immediately after client creation: it validates the token and
  // gives the cookie adapter a chance to persist a refresh before rendering.
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  // A demo session is a Supabase anonymous user. It holds a real, owner-scoped
  // session, so it passes here for the same reason a permanent account does;
  // the ledger it reaches is its own and nobody else's.
  const isAuthenticated =
    !error && typeof claims?.sub === "string" && claims.sub.length > 0;

  if (isProtectedPath(request.nextUrl.pathname) && !isAuthenticated) {
    return copySessionResponse(supabaseResponse, loginRedirect(request));
  }

  if (request.nextUrl.pathname === "/login" && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/daily";
    url.search = "";
    return copySessionResponse(supabaseResponse, NextResponse.redirect(url));
  }

  return supabaseResponse;
}
