import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signUpWithVerifiedTurnstile } from "@/lib/auth/signup";

export const runtime = "nodejs";

const responses = {
  challenge: { message: "Complete a fresh verification challenge and try again.", status: 400 },
  configuration: { message: "Signup is not configured in this environment.", status: 503 },
  signup: { message: "We could not start signup. Please try again.", status: 400 },
  unavailable: { message: "Verification is temporarily unavailable. Please try again.", status: 503 },
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

  const result = await signUpWithVerifiedTurnstile(
    {
      email: body.email,
      expectedHostname: new URL(request.url).hostname,
      password: body.password,
      turnstileToken: body.turnstileToken,
    },
    {
      createClient: createServerSupabaseClient,
      fetch,
      secret: process.env.TURNSTILE_SECRET_KEY,
    },
  );

  if (!result.ok) {
    const response = responses[result.code];
    return Response.json(response, { status: response.status });
  }

  return Response.json({ message: "Check your email to confirm your account.", status: "success" });
}
