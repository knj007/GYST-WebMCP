import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentProfile: vi.fn(), revalidatePath: vi.fn(), rpc: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ getCurrentProfile: mocks.getCurrentProfile }));
vi.mock("@/lib/rituals/weekly", () => ({ getWeekStart: () => "2026-08-31" }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ rpc: mocks.rpc })) }));
import { commitWeeklyRitual, saveWeeklyDraft } from "@/app/(ritual)/weekly/actions";

const initial = { message: "", status: "idle" } as const;
function form(fields: Record<string, string> = {}) { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); return data; }
const saved = { data: { ritual_session_id: "d3000000-0000-4000-8000-000000000001", status: "draft", version: 2 }, error: null };

describe("weekly ritual server actions", () => {
  beforeEach(() => { mocks.getCurrentProfile.mockResolvedValue({ profile: { timezone: "UTC" } }); mocks.revalidatePath.mockReset(); mocks.rpc.mockReset(); });
  test("rejects a malformed session version before writing", async () => {
    await expect(saveWeeklyDraft(initial, form({ session_version: "no" }))).resolves.toEqual({ message: "The weekly draft version is invalid. Refresh before saving.", status: "error" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  test("turns a stale draft response into bounded guidance", async () => {
    mocks.rpc.mockReturnValueOnce({ single: vi.fn().mockResolvedValue({ data: null, error: { code: "40001" } }) });
    await expect(saveWeeklyDraft(initial, form())).resolves.toEqual({ message: "The weekly draft changed elsewhere. Refresh before saving.", status: "error" });
  });
  test("commits only through the separate weekly commit RPC", async () => {
    mocks.rpc.mockReturnValueOnce({ single: vi.fn().mockResolvedValue(saved) }).mockResolvedValueOnce({ data: null, error: null });
    await expect(commitWeeklyRitual(initial, form({ session_version: "1", decision_text: "Focus", arrow: "up", priorities: "Priority | 2026-09-07" }))).resolves.toEqual({ message: "Weekly ritual committed. The record is now immutable.", status: "success" });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "save_weekly_ritual_draft", expect.any(Object));
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "commit_weekly_ritual", expect.objectContaining({ p_expected_version: 2 }));
  });
});
