import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentProfile: vi.fn(), redirect: vi.fn(), rpc: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    mocks.redirect(destination);
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT:")) throw error;
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentProfile: mocks.getCurrentProfile }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ rpc: mocks.rpc })) }));

import { saveOnboardingDraft } from "@/app/(welcome)/welcome/goals/actions";
import { commitOnboarding } from "@/app/(welcome)/welcome/review/actions";

const initial = { message: "", status: "idle" } as const;
const draftId = "d3000000-0000-4000-8000-000000000001";

function form(fields: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function rpcResult(result: { data: unknown; error: null | { code: string; message: string } }) {
  return { single: vi.fn().mockResolvedValue(result) };
}

describe("onboarding draft-save action", () => {
  beforeEach(() => {
    mocks.getCurrentProfile.mockResolvedValue({ identity: { isDemo: false, userId: "a8000000-0000-4000-8000-000000000001" }, profile: null });
    mocks.redirect.mockReset();
    mocks.rpc.mockReset();
  });

  test("never reaches the commit RPC, in source or at runtime", async () => {
    const source = readFileSync(join(process.cwd(), "src", "app", "(welcome)", "welcome", "goals", "actions.ts"), "utf8");
    expect(source).not.toContain("commit_onboarding");
    expect(source).not.toContain("add_commitment");

    mocks.rpc.mockReturnValueOnce(rpcResult({ data: { onboarding_draft_id: draftId, status: "draft", version: 1 }, error: null }));
    await saveOnboardingDraft(initial, form({ "areas.0.key": "a", "areas.0.title": "Studio", timezone: "UTC" }));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("save_onboarding_draft", expect.not.objectContaining({ p_expected_version: expect.anything() }));
    expect(mocks.rpc.mock.calls.every(([name]) => name === "save_onboarding_draft")).toBe(true);
  });

  test("passes the expected version and returns the new version to the form", async () => {
    mocks.rpc.mockReturnValueOnce(rpcResult({ data: { onboarding_draft_id: draftId, status: "draft", version: 3 }, error: null }));
    await expect(saveOnboardingDraft(initial, form({ draft_version: "2", timezone: "America/Chicago" }))).resolves.toEqual({
      draftId, message: "Draft saved. Nothing is committed until you review it.", status: "success", version: 3,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("save_onboarding_draft", { p_draft: expect.objectContaining({ timezone: "America/Chicago" }), p_expected_version: 2 });
  });

  test("lets a sign-in redirect thrown by requireUser escape the catch", async () => {
    mocks.getCurrentProfile.mockRejectedValueOnce(new Error("NEXT_REDIRECT:/login"));
    await expect(saveOnboardingDraft(initial, form())).rejects.toThrow("NEXT_REDIRECT:/login");
    mocks.getCurrentProfile.mockRejectedValueOnce(new Error("NEXT_REDIRECT:/login"));
    await expect(commitOnboarding(initial, form({ draft_id: draftId, draft_version: "1" }))).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("refuses a demo session before any RPC", async () => {
    mocks.getCurrentProfile.mockResolvedValueOnce({ identity: { isDemo: true }, profile: null });
    await expect(saveOnboardingDraft(initial, form())).resolves.toEqual({ message: "The demo ledger is already prepared. Open the daily ritual instead.", status: "error" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("rejects a malformed draft version before writing", async () => {
    await expect(saveOnboardingDraft(initial, form({ draft_version: "one" }))).resolves.toEqual({ message: "The onboarding draft version is invalid. Refresh before saving.", status: "error" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("maps stale, committed, shape, and unknown RPC failures to bounded guidance", async () => {
    mocks.rpc.mockReturnValueOnce(rpcResult({ data: null, error: { code: "40001", message: "onboarding draft has changed; refresh before saving" } }));
    await expect(saveOnboardingDraft(initial, form())).resolves.toEqual({ message: "The onboarding draft changed elsewhere. Refresh before saving.", status: "error" });

    mocks.rpc.mockReturnValueOnce(rpcResult({ data: null, error: { code: "23514", message: "onboarding is already committed" } }));
    await expect(saveOnboardingDraft(initial, form())).resolves.toEqual({ message: "Your founding statement is already committed. Open the daily ritual instead.", status: "error" });

    mocks.rpc.mockReturnValueOnce(rpcResult({ data: null, error: { code: "22023", message: "onboarding draft is too large" } }));
    await expect(saveOnboardingDraft(initial, form())).resolves.toEqual({ message: "onboarding draft is too large", status: "error" });

    mocks.rpc.mockReturnValueOnce(rpcResult({ data: null, error: { code: "XX000", message: "internal detail" } }));
    await expect(saveOnboardingDraft(initial, form())).resolves.toEqual({ message: "Unable to save the onboarding draft.", status: "error" });
  });
});

describe("founding commit action", () => {
  const commitForm = () => form({ draft_id: draftId, draft_version: "2" });

  beforeEach(() => {
    mocks.getCurrentProfile.mockResolvedValue({ identity: { isDemo: false, userId: "a8000000-0000-4000-8000-000000000001" }, profile: null });
    mocks.redirect.mockReset();
    mocks.rpc.mockReset();
  });

  test("commits through the separate commit RPC and moves on to the rhythm page", async () => {
    mocks.rpc.mockReturnValueOnce(rpcResult({ data: { committed_at: "2026-09-02T12:00:00Z", founding_commitment_id: "c3000000-0000-4000-8000-000000000001", onboarding_draft_id: draftId, version: 3 }, error: null }));
    await expect(commitOnboarding(initial, commitForm())).rejects.toThrow("NEXT_REDIRECT:/welcome/rhythm");
    expect(mocks.rpc).toHaveBeenCalledWith("commit_onboarding", { p_expected_version: 2, p_onboarding_draft_id: draftId });
    expect(mocks.redirect).toHaveBeenCalledWith("/welcome/rhythm");
  });

  test("treats an idempotent replay as success", async () => {
    mocks.rpc.mockReturnValueOnce(rpcResult({ data: { committed_at: "2026-09-01T12:00:00Z", founding_commitment_id: "c3000000-0000-4000-8000-000000000001", onboarding_draft_id: draftId, version: 3 }, error: null }));
    await expect(commitOnboarding(initial, commitForm())).rejects.toThrow("NEXT_REDIRECT:/welcome/rhythm");
  });

  test("asks for a refresh on a stale version", async () => {
    mocks.rpc.mockReturnValueOnce(rpcResult({ data: null, error: { code: "40001", message: "onboarding draft has changed; refresh before committing" } }));
    await expect(commitOnboarding(initial, commitForm())).resolves.toEqual({ message: "The onboarding draft changed elsewhere. Refresh before committing.", status: "error" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  test("shows the database's own validation message and points back to the draft", async () => {
    mocks.rpc.mockReturnValueOnce(rpcResult({ data: null, error: { code: "22023", message: "goal references an unknown area key" } }));
    await expect(commitOnboarding(initial, commitForm())).resolves.toEqual({ fixable: true, message: "goal references an unknown area key", status: "error" });

    mocks.rpc.mockReturnValueOnce(rpcResult({ data: null, error: { code: "23514", message: "onboarding must create at least one active commitment" } }));
    await expect(commitOnboarding(initial, commitForm())).resolves.toEqual({ fixable: true, message: "onboarding must create at least one active commitment", status: "error" });
  });

  test("refuses to commit without a draft id or version and never reaches the RPC", async () => {
    await expect(commitOnboarding(initial, form({ draft_version: "2" }))).resolves.toEqual({ message: "The onboarding draft could not be identified. Refresh before committing.", status: "error" });
    await expect(commitOnboarding(initial, form({ draft_id: draftId }))).resolves.toEqual({ message: "The onboarding draft version is invalid. Refresh before committing.", status: "error" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("sends a demo session to the ritual instead of failing", async () => {
    mocks.getCurrentProfile.mockResolvedValueOnce({ identity: { isDemo: true }, profile: null });
    await expect(commitOnboarding(initial, commitForm())).rejects.toThrow("NEXT_REDIRECT:/daily");
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.rpc.mockReturnValueOnce(rpcResult({ data: null, error: { code: "42501", message: "demo sessions cannot onboard" } }));
    await expect(commitOnboarding(initial, commitForm())).rejects.toThrow("NEXT_REDIRECT:/daily");
  });
});
