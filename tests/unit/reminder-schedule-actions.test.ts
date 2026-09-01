import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), getCurrentProfile: vi.fn(), insert: vi.fn(), rpc: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ getCurrentProfile: mocks.getCurrentProfile }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ from: mocks.from, rpc: mocks.rpc })) }));

import { saveRitualReminderSchedule } from "@/app/(ritual)/settings/schedule/actions";

const initial = { message: "", status: "idle" } as const;

function form(fields: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("ritual reminder schedule action", () => {
  beforeEach(() => {
    mocks.getCurrentProfile.mockResolvedValue({ identity: { isDemo: false, userId: "a8000000-0000-4000-8000-000000000001" }, profile: { timezone: "UTC" } });
    mocks.from.mockReset();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockReset();
    mocks.rpc.mockReset();
  });

  test("saves a validated daily reminder through the narrow schedule RPC", async () => {
    mocks.rpc.mockResolvedValue({ error: null });

    await expect(saveRitualReminderSchedule(initial, form({ ritual_kind: "daily", local_time: "20:00", enabled: "on" }))).resolves.toEqual({
      message: "Reminder schedule saved.", status: "success", timezone: "UTC",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("save_ritual_reminder_schedule", {
      p_enabled: true, p_local_time: "20:00", p_ritual_kind: "daily", p_weekday: null,
    });
  });

  test("requires an ISO weekday for a weekly reminder before writing", async () => {
    await expect(saveRitualReminderSchedule(initial, form({ ritual_kind: "weekly", local_time: "09:00", enabled: "on", weekday: "0" }))).resolves.toEqual({
      message: "Choose a day for the weekly reminder.", status: "error",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("rejects demo sessions before writing a reminder rule", async () => {
    mocks.getCurrentProfile.mockResolvedValueOnce({ identity: { isDemo: true }, profile: { timezone: "UTC" } });

    await expect(saveRitualReminderSchedule(initial, form({ ritual_kind: "daily", local_time: "20:00" }))).resolves.toEqual({
      message: "Reminder schedules are available after creating an account.", status: "error",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("initializes a missing profile from the browser timezone before saving", async () => {
    mocks.getCurrentProfile.mockResolvedValueOnce({ identity: { isDemo: false, userId: "a8000000-0000-4000-8000-000000000001" }, profile: null });
    mocks.insert.mockResolvedValueOnce({ error: null });
    mocks.rpc.mockResolvedValueOnce({ error: null });

    await expect(saveRitualReminderSchedule(initial, form({ ritual_kind: "daily", local_time: "20:00", timezone: "America/Chicago" }))).resolves.toEqual({
      message: "Reminder schedule paused.", status: "success", timezone: "America/Chicago",
    });
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.insert).toHaveBeenCalledWith({ timezone: "America/Chicago", user_id: "a8000000-0000-4000-8000-000000000001" });
  });

  test("continues after a concurrent profile initializer wins the insert race", async () => {
    mocks.getCurrentProfile.mockResolvedValueOnce({ identity: { isDemo: false, userId: "a8000000-0000-4000-8000-000000000001" }, profile: null });
    mocks.insert.mockResolvedValueOnce({ error: { code: "23505" } });
    mocks.rpc.mockResolvedValueOnce({ error: null });

    await expect(saveRitualReminderSchedule(initial, form({ ritual_kind: "weekly", local_time: "09:00", timezone: "America/Chicago", weekday: "1" }))).resolves.toEqual({
      message: "Reminder schedule paused.", status: "success", timezone: "America/Chicago",
    });
    expect(mocks.rpc).toHaveBeenCalled();
  });

  test("rejects an invalid browser timezone before writing a profile", async () => {
    mocks.getCurrentProfile.mockResolvedValueOnce({ identity: { isDemo: false, userId: "a8000000-0000-4000-8000-000000000001" }, profile: null });

    await expect(saveRitualReminderSchedule(initial, form({ ritual_kind: "daily", local_time: "20:00", timezone: "not-a-timezone" }))).resolves.toEqual({
      message: "Your browser timezone could not be determined.", status: "error",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
