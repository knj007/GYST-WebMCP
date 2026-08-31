import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ getCurrentProfile: mocks.getCurrentProfile }));
vi.mock("@/lib/rituals/daily", () => ({ getLocalDate: () => "2026-08-30" }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

import {
  commitDailyRitual,
  saveDailyDraft,
} from "@/app/(ritual)/daily/actions";

const initialDailyActionState = { message: "", status: "idle" } as const;

function dailyForm(fields: Record<string, string> = {}) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return formData;
}

function successfulDraft(version = 2) {
  return { data: { ritual_session_id: "d3000000-0000-4000-8000-000000000001", status: "draft", version }, error: null };
}

describe("daily ritual server actions", () => {
  beforeEach(() => {
    mocks.getCurrentProfile.mockResolvedValue({ profile: { timezone: "UTC" } });
    mocks.revalidatePath.mockReset();
    mocks.rpc.mockReset();
  });

  test("does not reach the RPC when authentication fails", async () => {
    mocks.getCurrentProfile.mockRejectedValueOnce(new Error("Authentication is required."));

    await expect(saveDailyDraft(initialDailyActionState, dailyForm())).resolves.toEqual({
      message: "Authentication is required.",
      status: "error",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("rejects a malformed session version before writing", async () => {
    const state = await saveDailyDraft(initialDailyActionState, dailyForm({ session_version: "zero" }));

    expect(state).toEqual({
      message: "The daily draft version is invalid. Refresh before saving.",
      status: "error",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("turns an omitted version rejected by the RPC into stale-draft guidance", async () => {
    mocks.rpc.mockReturnValueOnce({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "40001", message: "daily ritual draft has changed; refresh before saving" },
      }),
    });

    const state = await saveDailyDraft(initialDailyActionState, dailyForm());

    expect(state).toEqual({
      message: "The daily draft changed elsewhere. Refresh before saving.",
      status: "error",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "save_daily_ritual_draft",
      expect.not.objectContaining({ p_expected_session_version: expect.anything() }),
    );
  });

  test("returns a bounded message for an unexpected draft RPC failure", async () => {
    mocks.rpc.mockReturnValueOnce({
      single: vi.fn().mockResolvedValue({ data: null, error: { code: "XX000", message: "internal detail" } }),
    });

    await expect(saveDailyDraft(initialDailyActionState, dailyForm())).resolves.toEqual({
      message: "Unable to save the daily draft.",
      status: "error",
    });
  });

  test("shows stale-draft guidance when the commit RPC rejects its version", async () => {
    mocks.rpc
      .mockReturnValueOnce({ single: vi.fn().mockResolvedValue(successfulDraft()) })
      .mockResolvedValueOnce({ data: null, error: { code: "40001", message: "draft changed" } });

    await expect(commitDailyRitual(initialDailyActionState, dailyForm({ session_version: "1" }))).resolves.toEqual({
      message: "The daily draft changed elsewhere. Refresh before committing.",
      status: "error",
    });
  });

  test("treats an already-committed draft-save retry as a successful committed state", async () => {
    mocks.rpc.mockReturnValueOnce({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23514", message: "today's daily ritual is already committed" },
      }),
    });

    await expect(commitDailyRitual(initialDailyActionState, dailyForm({ session_version: "2" }))).resolves.toEqual({
      message: "Daily ritual committed. The record is now immutable.",
      status: "success",
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/daily");
  });
});
