import { createServerSupabaseClient } from "@/lib/supabase/server";
import { startDemoSession } from "@/lib/demo/session";

export const runtime = "nodejs";
// Every demo session is a distinct anonymous user. Supabase warns that static
// rendering can cache one anonymous user's metadata for another, so this route
// stays request-dynamic.
export const dynamic = "force-dynamic";

const responses = {
  challenge: { message: "Complete a fresh verification challenge and try again.", status: 400 },
  seed: { message: "We could not prepare the demo ledger. Please try again.", status: 503 },
  unavailable: { message: "The demo is temporarily unavailable. Please try again.", status: 503 },
} as const;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json(responses.challenge, { status: responses.challenge.status });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json(responses.challenge, { status: responses.challenge.status });
  }

  const result = await startDemoSession(
    { turnstileToken: body.turnstileToken },
    { createClient: createServerSupabaseClient },
  );

  if (!result.ok) {
    const response = responses[result.code];
    return Response.json(response, { status: response.status });
  }

  return Response.json({ redirectTo: "/daily", status: "success" });
}
