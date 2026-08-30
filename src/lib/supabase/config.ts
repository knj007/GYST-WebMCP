export type SupabasePublicConfig = {
  publishableKey: string;
  url: string;
};

type PublicEnvironment = {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
};

export function readSupabasePublicConfig(
  environment: PublicEnvironment = {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
): SupabasePublicConfig | null {
  const publishableKey =
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const rawUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!publishableKey || !rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return { publishableKey, url: url.toString().replace(/\/$/, "") };
  } catch {
    return null;
  }
}

export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = readSupabasePublicConfig();

  if (!config) {
    throw new Error("Supabase public configuration is unavailable.");
  }

  return config;
}
