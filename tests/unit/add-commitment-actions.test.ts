import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentProfile: vi.fn(), revalidatePath: vi.fn(), rpc: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ getCurrentProfile: mocks.getCurrentProfile }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ rpc: mocks.rpc })) }));

import { addCommitment } from "@/lib/commitments/actions";

const initial = { message: "", status: "idle" } as const;
const goalId = "b3000000-0000-4000-8000-000000000001";

function form(fields: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("add commitment action", () => {
  beforeEach(() => {
    mocks.getCurrentProfile.mockResolvedValue({ identity: { isDemo: false, userId: "a8000000-0000-4000-8000-000000000001" }, profile: { timezone: "UTC" } });
    mocks.revalidatePath.mockReset();
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: [{ commitment_id: "c3000000-0000-4000-8000-000000000009" }], error: null });
  });

  test("passes undefined, never null, for omitted optional arguments", async () => {
    await expect(addCommitment(initial, form({ goal_id: goalId, title: "  Call the printer  " }))).resolves.toEqual({
      message: "Commitment added. It is active and can be chosen as tomorrow’s commitment.", status: "success",
    });
    const [name, args] = mocks.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("add_commitment");
    expect(args).toEqual({ p_details: undefined, p_due_on: undefined, p_goal_id: goalId, p_title: "Call the printer" });
    expect("p_details" in args && args.p_details === undefined).toBe(true);
    expect(Object.values(args)).not.toContain(null);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/daily");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/weekly");
  });

  test("passes supplied optional arguments through", async () => {
    await addCommitment(initial, form({ details: "Ask about the deposit", due_on: "2026-09-09", goal_id: goalId, title: "Call the printer" }));
    expect(mocks.rpc).toHaveBeenCalledWith("add_commitment", { p_details: "Ask about the deposit", p_due_on: "2026-09-09", p_goal_id: goalId, p_title: "Call the printer" });
  });

  test("validates input before reaching the RPC", async () => {
    await expect(addCommitment(initial, form({ goal_id: "not-a-goal", title: "x" }))).resolves.toEqual({ message: "Choose the goal this commitment serves.", status: "error" });
    await expect(addCommitment(initial, form({ goal_id: goalId, title: "   " }))).resolves.toEqual({ message: "A commitment title must be between 1 and 500 characters.", status: "error" });
    await expect(addCommitment(initial, form({ due_on: "soon", goal_id: goalId, title: "x" }))).resolves.toEqual({ message: "Choose a valid due date.", status: "error" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("maps ownership, goal-state, and length failures to bounded messages", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "goal was not found" } });
    await expect(addCommitment(initial, form({ goal_id: goalId, title: "x" }))).resolves.toEqual({ message: "That goal was not found in your ledger.", status: "error" });

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "23514", message: "commitments can only be added to an active goal" } });
    await expect(addCommitment(initial, form({ goal_id: goalId, title: "x" }))).resolves.toEqual({ message: "Commitments can only be added to an active goal.", status: "error" });

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "commitment title must be between 1 and 500 characters" } });
    await expect(addCommitment(initial, form({ goal_id: goalId, title: "x" }))).resolves.toEqual({ message: "commitment title must be between 1 and 500 characters", status: "error" });

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "internal detail" } });
    await expect(addCommitment(initial, form({ goal_id: goalId, title: "x" }))).resolves.toEqual({ message: "Unable to add the commitment.", status: "error" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("is reachable from no WebMCP library or route", () => {
    const root = process.cwd();
    const files = [...sourceFiles(join(root, "src", "lib", "webmcp")), ...sourceFiles(join(root, "src", "app", "api", "webmcp"))];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("add_commitment");
      expect(source, file).not.toContain("addCommitment");
      expect(source, file).not.toContain("commitments/actions");
    }
  });
});
