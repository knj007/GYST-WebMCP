import { execFileSync } from "node:child_process";

type LocalSupabaseEnvironment = {
  apiUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
};

type LocalSupabasePublicEnvironment = Pick<LocalSupabaseEnvironment, "apiUrl" | "publishableKey">;

const cachedEnvironmentNames = {
  apiUrl: "GYST_E2E_LOCAL_SUPABASE_URL",
  publishableKey: "GYST_E2E_LOCAL_SUPABASE_PUBLISHABLE_KEY",
} as const;

function readStatusEnvironment() {
  try {
    return execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error("Local Supabase must be running before authenticated E2E tests can start.");
  }
}

function parseStatusEnvironment(output: string) {
  const values = new Map<string, string>();

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    const rawValue = match[2];
    if (!key || rawValue === undefined) {
      continue;
    }
    const value = rawValue.replace(/^(?:"|')|(?:"|')$/g, "");
    values.set(key, value);
  }

  return values;
}

function assertLocalApiUrl(apiUrl: string) {
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new Error("The E2E Supabase API URL is invalid.");
  }

  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(url.hostname)) {
    throw new Error("Authenticated E2E tests are restricted to the local Supabase stack.");
  }

  return url.toString().replace(/\/$/, "");
}

export function getLocalSupabasePublicEnvironment(): LocalSupabasePublicEnvironment {
  const cached = {
    apiUrl: process.env[cachedEnvironmentNames.apiUrl],
    publishableKey: process.env[cachedEnvironmentNames.publishableKey],
  };
  if (cached.apiUrl && cached.publishableKey) {
    return { apiUrl: assertLocalApiUrl(cached.apiUrl), publishableKey: cached.publishableKey };
  }

  const environment = getLocalSupabaseEnvironment();
  return { apiUrl: environment.apiUrl, publishableKey: environment.publishableKey };
}

export function getLocalSupabaseEnvironment(): LocalSupabaseEnvironment {
  const values = parseStatusEnvironment(readStatusEnvironment());
  const apiUrl = values.get("API_URL") ?? values.get("SUPABASE_URL");
  const publishableKey = values.get("PUBLISHABLE_KEY") ?? values.get("ANON_KEY");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");

  if (!apiUrl || !publishableKey || !serviceRoleKey) {
    throw new Error("Local Supabase did not provide the E2E connection values.");
  }

  const environment = { apiUrl: assertLocalApiUrl(apiUrl), publishableKey, serviceRoleKey };
  process.env[cachedEnvironmentNames.apiUrl] = environment.apiUrl;
  process.env[cachedEnvironmentNames.publishableKey] = environment.publishableKey;

  return environment;
}
