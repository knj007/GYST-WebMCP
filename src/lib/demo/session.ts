import "server-only";

const maxTokenLength = 2048;

type DemoClient = {
  auth: {
    signInAnonymously: (credentials?: {
      options?: { captchaToken?: string };
    }) => Promise<{ error: { message?: string } | null }>;
  };
  // PostgREST builders are thenable rather than real promises, so the
  // contract here is what `await` actually needs.
  rpc: (name: "seed_demo_ledger") => PromiseLike<{ error: { message?: string } | null }>;
};

export type DemoSessionInput = {
  turnstileToken: unknown;
};

export type DemoSessionResult =
  | { code: "success"; ok: true }
  | { code: "challenge" | "seed" | "unavailable"; ok: false };

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

  const { error: signInError } = await client.auth.signInAnonymously({
    options: { captchaToken: token },
  });

  if (signInError) {
    return {
      code: /captcha/i.test(signInError.message ?? "") ? "challenge" : "unavailable",
      ok: false,
    };
  }

  const { error: seedError } = await client.rpc("seed_demo_ledger");

  if (seedError) {
    return { code: "seed", ok: false };
  }

  return { code: "success", ok: true };
}
