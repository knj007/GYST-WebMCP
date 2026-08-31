import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const repositoryRoot = process.cwd();
const dailyActionsPath = join(repositoryRoot, "src", "app", "(ritual)", "daily", "actions.ts");
const webMcpToolsPath = join(repositoryRoot, "src", "lib", "webmcp");

describe("WebMCP daily capability boundary", () => {
  test("has no WebMCP tool surface while Wave 3 exposes only the normal human form", () => {
    expect(existsSync(webMcpToolsPath)).toBe(false);
  });

  test("keeps the commit RPC out of the draft-save server action", () => {
    const actions = readFileSync(dailyActionsPath, "utf8");
    const draftAction = actions.slice(
      actions.indexOf("export async function saveDailyDraft"),
      actions.indexOf("export async function commitDailyRitual"),
    );

    expect(draftAction).not.toContain("commit_daily_ritual");
    expect(actions.match(/commit_daily_ritual/g)).toHaveLength(1);
  });
});
