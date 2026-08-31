import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

function loginRedirect(request: Request) {
  return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (!tokenHash || type !== "email") {
    return loginRedirect(request);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });

  if (error) {
    return loginRedirect(request);
  }

  return NextResponse.redirect(new URL("/daily", request.url));
}
