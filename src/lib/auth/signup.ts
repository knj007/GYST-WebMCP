import "server-only";

const maxTokenLength = 2048;

type SignUpClient = {
  auth: {
    signUp: (credentials: {
      email: string;
      options?: { captchaToken?: string };
      password: string;
    }) => Promise<{ error: { message?: string } | null }>;
  };
};

export type SignupInput = {
  email: unknown;
  password: unknown;
  turnstileToken: unknown;
};

export type SignupResult =
  | { code: "success"; ok: true }
  | { code: "challenge" | "signup"; ok: false };

type SignupDependencies = {
  createClient: () => Promise<SignUpClient>;
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

export function isSignupConfigured(environment: NodeJS.ProcessEnv = process.env) {
  return Boolean(environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

/**
 * Create a permanent account behind a Turnstile challenge.
 *
 * The token is verified by Supabase Auth, not here. Supabase applies its
 * captcha to every auth endpoint, including the anonymous sign-in the judge
 * demo uses; verifying in the application instead would consume the
 * single-use token and leave the directly reachable Auth endpoints unguarded.
 */
export async function signUpWithTurnstile(
  input: SignupInput,
  dependencies: SignupDependencies,
): Promise<SignupResult> {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);
  const token = normalizeToken(input.turnstileToken);

  if (
    !email ||
    email.length > 320 ||
    !password ||
    password.length > 1024 ||
    !token ||
    token.length > maxTokenLength
  ) {
    return { code: "challenge", ok: false };
  }

  const client = await dependencies.createClient();
  const { error } = await client.auth.signUp({
    email,
    options: { captchaToken: token },
    password,
  });

  if (!error) {
    return { code: "success", ok: true };
  }

  // A rejected challenge is recoverable by solving a fresh one; anything else
  // is reported as a signup failure without echoing provider detail.
  return { code: /captcha/i.test(error.message ?? "") ? "challenge" : "signup", ok: false };
}
