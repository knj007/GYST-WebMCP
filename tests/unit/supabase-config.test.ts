import { describe, expect, test } from "vitest";

import { readSupabasePublicConfig } from "@/lib/supabase/config";

describe("Supabase public configuration", () => {
  test("returns null when either public value is missing", () => {
    expect(readSupabasePublicConfig({})).toBeNull();
    expect(
      readSupabasePublicConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }),
    ).toBeNull();
  });

  test("rejects non-HTTP project URLs", () => {
    expect(
      readSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
        NEXT_PUBLIC_SUPABASE_URL: "javascript:alert(1)",
      }),
    ).toBeNull();
  });

  test("normalizes a complete public configuration", () => {
    expect(
      readSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_example ",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/",
      }),
    ).toEqual({
      publishableKey: "sb_publishable_example",
      url: "https://example.supabase.co",
    });
  });
});
