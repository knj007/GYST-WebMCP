import "server-only";

const maxTokenLength = 2048;

type DemoClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims?: { is_anonymous?: boolean; sub?: string } } | null;
      error: unknown | null;
    }>;
    signInAnonymously: (credentials?: {
      options?: { captchaToken?: string };
    }) => Promise<{ error: { message?: string } | null }>;
  };
  // PostgREST builders are thenable rather than real promises, so the
  // contract here is what `await` actually needs.
  rpc: (
    name: "seed_demo_ledger",
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export type DemoSessionInput = {
  turnstileToken: unknown;
};

export type DemoSessionResult =
  | { code: "success"; ok: true }
  | { code: "challenge" | "seed" | "signed-in" | "unavailable"; ok: false };

export type DemoSessionDependencies = {
  createClient: () => Promise<DemoClient>;
};

function normalizeToken(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isDemoConfigured(environment: NodeJS.ProcessEnv = process.env) {
  return Boolean(environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

/**
 * Start one throwaway demo session and give it a fictional ledger.
 *
 * The anonymous sign-in endpoint is publicly reachable with the browser's
 * publishable key, so the challenge token is verified by Supabase Auth rather
 * than here; verifying it in this route would only protect this route. Seeding
 * runs as the new demo owner through an invoker-rights RPC, so the session can
 * only ever populate itself.
 */
export async function startDemoSession(
  input: DemoSessionInput,
  dependencies: DemoSessionDependencies,
): Promise<DemoSessionResult> {
  const token = normalizeToken(input.turnstileToken);

  if (!token || token.length > maxTokenLength) {
    return { code: "challenge", ok: false };
  }

  let client: DemoClient;
  try {
    client = await dependencies.createClient();
  } catch {
    return { code: "unavailable", ok: false };
  }

  // Signing in anonymously overwrites whatever session cookie is present, so a
  // signed-in owner would be silently swapped onto a throwaway identity. Their
  // ledger would survive, but they would be logged out with no explanation.
  const { data: existing } = await client.auth.getClaims();
  const existingClaims = existing?.claims;
  if (typeof existingClaims?.sub === "string" && existingClaims.is_anonymous !== true) {
    return { code: "signed-in", ok: false };
  }

  const { error: signInError } = await client.auth.signInAnonymously({
    options: { captchaToken: token },
  });

  if (signInError) {
    return {
      code: /captcha/i.test(signInError.message ?? "") ? "challenge" : "unavailable",
      ok: false,
    };
  }

  const { data: seeded, error: seedError } = await client.rpc("seed_demo_ledger");

  // The RPC declines rather than raising when a ledger already exists. Treating
  // that as success would hand a visitor an empty demo and call it ready.
  if (seedError || (seeded as { seeded?: boolean } | null)?.seeded !== true) {
    return { code: "seed", ok: false };
  }

  return { code: "success", ok: true };
}
