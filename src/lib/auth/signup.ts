import "server-only";

const siteverifyEndpoint = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const maxTokenLength = 2048;

type SignUpClient = {
  auth: {
    signUp: (credentials: { email: string; password: string }) => Promise<{ error: unknown | null }>;
  };
};

type SiteverifyResult = {
  "error-codes"?: string[];
  hostname?: string;
  success?: boolean;
};

export type SignupInput = {
  email: unknown;
  expectedHostname: string;
  password: unknown;
  turnstileToken: unknown;
};

export type SignupResult =
  | { code: "success"; ok: true }
  | { code: "challenge" | "configuration" | "signup" | "unavailable"; ok: false };

type SignupDependencies = {
  createClient: () => Promise<SignUpClient>;
  fetch: typeof globalThis.fetch;
  secret: string | undefined;
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
  return Boolean(environment.TURNSTILE_SECRET_KEY?.trim());
}

export async function signUpWithVerifiedTurnstile(
  input: SignupInput,
  dependencies: SignupDependencies,
): Promise<SignupResult> {
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);
  const token = normalizeToken(input.turnstileToken);
  const secret = dependencies.secret?.trim();

  if (!secret) {
    return { code: "configuration", ok: false };
  }

  if (!email || email.length > 320 || !password || password.length > 1024 || !token || token.length > maxTokenLength) {
    return { code: "challenge", ok: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  body.set("idempotency_key", crypto.randomUUID());

  let response: Response;
  try {
    response = await dependencies.fetch(siteverifyEndpoint, {
      body,
      method: "POST",
      signal: controller.signal,
    });
  } catch {
    return { code: "unavailable", ok: false };
  } finally {
    clearTimeout(timeout);
  }

  let verification: SiteverifyResult;
  try {
    verification = (await response.json()) as SiteverifyResult;
  } catch {
    return { code: "unavailable", ok: false };
  }

  if (!response.ok) {
    return { code: "unavailable", ok: false };
  }

  if (!verification.success || verification.hostname !== input.expectedHostname) {
    return { code: "challenge", ok: false };
  }

  const client = await dependencies.createClient();
  const { error } = await client.auth.signUp({ email, password });

  return error ? { code: "signup", ok: false } : { code: "success", ok: true };
}
