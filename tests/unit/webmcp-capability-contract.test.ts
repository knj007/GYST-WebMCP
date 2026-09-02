import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { webMcpSiteToolsScript } from "@/lib/webmcp/site-tools-script";

const repositoryRoot = process.cwd();
const dailyActionsPath = join(repositoryRoot, "src", "app", "(ritual)", "daily", "actions.ts");
const webMcpToolsPath = join(repositoryRoot, "src", "lib", "webmcp");
const rootLayoutPath = join(repositoryRoot, "src", "app", "layout.tsx");

describe("WebMCP daily capability boundary", () => {
  test("registers only the fourteen draft/read tools and never a commit or delete tool", () => {
    expect(existsSync(webMcpToolsPath)).toBe(true);
    const tools = readFileSync(join(webMcpToolsPath, "contracts.ts"), "utf8");
    const registration = readFileSync(join(repositoryRoot, "src", "components", "webmcp-tools.tsx"), "utf8");
    const toolNames = Array.from(registration.matchAll(/(?:name: |mutation\()"(gyst\.[^"]+)"/g), (match) => match[1]).filter((name): name is string => typeof name === "string");
    expect(toolNames).toHaveLength(14);
    expect(registration).toContain('oneOf: [');
    expect(registration).toContain('{ required: ["text", "type"] }');
    expect(toolNames.some((name) => /^gyst\.(?:commit|delete|export|sql|history)/i.test(name))).toBe(false);
    expect(tools).not.toContain("commit_daily_ritual");
    expect(readFileSync(join(repositoryRoot, "src", "app", "api", "webmcp", "daily", "route.ts"), "utf8")).not.toContain("commit_daily_ritual");
    expect(readFileSync(join(repositoryRoot, "src", "app", "api", "webmcp", "weekly", "route.ts"), "utf8")).not.toContain("commit_weekly_ritual");
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

  test("registers only read-only or navigation recovery tools before hydration", () => {
    const rootLayout = readFileSync(rootLayoutPath, "utf8");
    const recoveryToolNames = Array.from(webMcpSiteToolsScript.matchAll(/name: "(gyst\.[^"]+)"/g), (match) => match[1]);

    expect(rootLayout).toContain('strategy="beforeInteractive"');
    expect(webMcpSiteToolsScript).toContain('typeof context.registerTool !== "function"');
    expect(recoveryToolNames).toEqual(["gyst.get_status", "gyst.open_daily_ritual", "gyst.open_weekly_ritual"]);
    expect(rootLayout).not.toMatch(/gyst\.(?:commit|delete|export|sql|history)/i);
  });

  test("retries the early recovery surface when WebMCP becomes available after the first script check", async () => {
    const scheduled: Array<() => void> = [];
    const registrations: string[] = [];
    type FakeDocument = { modelContext: undefined | { registerTool: (tool: { name: string }) => Promise<void> } };
    type FakeWindow = { location: { assign: () => void; pathname: string }; setTimeout: (callback: () => void) => number };
    const fakeDocument: FakeDocument = { modelContext: undefined };
    const fakeWindow: FakeWindow = { location: { assign: () => undefined, pathname: "/login" }, setTimeout: (callback) => { scheduled.push(callback); return scheduled.length; } };
    const runScript = new Function("document", "window", "console", webMcpSiteToolsScript) as (document: FakeDocument, window: FakeWindow, console: Pick<Console, "warn">) => void;

    runScript(fakeDocument, fakeWindow, console);
    expect(scheduled).toHaveLength(1);
    fakeDocument.modelContext = { registerTool: async ({ name }) => { registrations.push(name); } };
    scheduled.shift()!();
    await Promise.resolve();

    expect(registrations).toEqual(["gyst.get_status", "gyst.open_daily_ritual", "gyst.open_weekly_ritual"]);
  });
});
