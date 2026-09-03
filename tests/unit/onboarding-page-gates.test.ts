import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

// The onboarding gate is a per-page decision: the ritual pages hold it, the
// account page never does, so a new owner can always reach account deletion.
const root = process.cwd();
const ritualRoot = join(root, "src", "app", "(ritual)");
const read = (...segments: string[]) => readFileSync(join(ritualRoot, ...segments), "utf8");
const gated = [["daily", "page.tsx"], ["weekly", "page.tsx"], ["settings", "schedule", "page.tsx"]] as const;

describe("onboarding page gates", () => {
  test("the daily, weekly, and schedule pages require a founded ledger before loading anything", () => {
    for (const segments of gated) {
      const source = read(...segments);
      expect(source, segments.join("/")).toContain('from "@/lib/onboarding/access"');
      const gate = source.indexOf("await requireOnboarded()");
      expect(gate, `${segments.join("/")} does not call requireOnboarded`).toBeGreaterThan(-1);
      const body = source.slice(source.indexOf("export default async function"));
      expect(body.indexOf("await requireOnboarded()"), `${segments.join("/")} gates after other awaits`).toBe(body.indexOf("await "));
    }
  });

  test("the account page and the ritual layout carry no onboarding gate", () => {
    for (const source of [read("settings", "account", "page.tsx"), read("layout.tsx")]) {
      // Call syntax, so a comment may still name the helper it deliberately omits.
      expect(source).not.toContain("requireOnboarded(");
      expect(source).not.toContain("needsOnboarding(");
      expect(source).not.toContain('redirect("/welcome")');
      expect(source).not.toContain('from "@/lib/onboarding/');
    }
  });

  test("the welcome header links to the account page", () => {
    const header = readFileSync(join(root, "src", "components", "welcome-header.tsx"), "utf8");
    expect(header).toContain('href="/settings/account"');
  });
});
