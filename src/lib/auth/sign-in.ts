import "server-only";

const maxTokenLength = 2048;

type SignInClient = {
  auth: {
    signInWithPassword: (credentials: {
      email: string;
      options?: { captchaToken?: string };
      password: string;
    }) => Promise<{ error: { message?: string } | null }>;
  };
};

export type SignInInput = {
  email: unknown;
  password: unknown;
  turnstileToken: unknown;
};

export type SignInResult =
  | { code: "success"; ok: true }
  | { code: "challenge" | "credentials" | "invalid"; ok: false };

type SignInDependencies = {
  createClient: () => Promise<SignInClient>;
  requiresChallenge: boolean;
};

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePassword(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeToken(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isSignInChallengeConfigured(environment: NodeJS.ProcessEnv = process.env) {
  return Boolean(environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

/**
 * Sign a returning owner in behind the same Turnstile challenge signup uses.
 *
 * Supabase applies its captcha to every auth endpoint, not just signup, so a
 * hosted project with captcha enabled rejects `token?grant_type=password`
 * before it ever compares the password. Sending no token there makes every
 * sign-in fail as `captcha_failed`, which is indistinguishable from a wrong
 * password to anyone reading the screen. The token is verified by Supabase
 * Auth, never here: verifying in the application would consume the single-use
 * token and leave the directly reachable Auth endpoint unguarded.
 *
 * When no site key is configured the challenge is skipped, which keeps the
 * local stack — where captcha is deliberately off — usable without one.
 */
export async function signInWithTurnstile(
  input: SignInInput,
  dependencies: SignInDependencies,
): Promise<SignInResult> {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);
  const token = normalizeToken(input.turnstileToken);

  if (!email || email.length > 320 || !password || password.length > 1024) {
    return { code: "invalid", ok: false };
  }

  if (token.length > maxTokenLength || (dependencies.requiresChallenge && !token)) {
    return { code: "challenge", ok: false };
  }

  const client = await dependencies.createClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
    ...(token ? { options: { captchaToken: token } } : {}),
  });

  if (!error) {
    return { code: "success", ok: true };
  }

  // A rejected challenge is recoverable by solving a fresh one. Anything else
  // is reported as a credentials failure without echoing provider detail.
  return { code: /captcha/i.test(error.message ?? "") ? "challenge" : "credentials", ok: false };
}
