import { afterEach, describe, expect, it, vi } from "vitest";

import { deliverDueReminders } from "../../workers/reminders/src/delivery";

const env = {
  REMINDER_FROM_EMAIL: "GYST <reminders@example.test>",
  RESEND_API_KEY: "test-resend-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  SUPABASE_URL: "https://project.example.test",
};

const reminder = {
  notification_event_id: "11111111-1111-4111-8111-111111111111",
  reminder_rule_id: "22222222-2222-4222-8222-222222222222",
  recipient_email: "fictional-recipient@example.test",
  scheduled_for: "2026-09-01T09:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("deliverDueReminders", () => {
  it("claims, sends once with the event idempotency key, and reconciles delivery", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("claim_due_reminder_notifications")) return Response.json([reminder]);
      if (url.endsWith("reminder_claim_is_active")) return Response.json(true);
      if (url === "https://api.resend.com/emails") {
        expect(init?.headers).toMatchObject({ "idempotency-key": reminder.notification_event_id });
        return Response.json({ id: "provider-message-1" });
      }
      if (url.endsWith("record_reminder_delivery")) return Response.json(true);
      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await deliverDueReminders(env, new Date("2026-09-01T09:15:00.000Z"));

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("skips an inactive claim without stranding later claimed reminders", async () => {
    const secondReminder = { ...reminder, notification_event_id: "33333333-3333-4333-8333-333333333333", reminder_rule_id: "44444444-4444-4444-8444-444444444444" };
    let activeCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("claim_due_reminder_notifications")) return Response.json([reminder, secondReminder]);
      if (url.endsWith("reminder_claim_is_active")) return Response.json(++activeCalls > 1);
      if (url === "https://api.resend.com/emails") return Response.json({ id: "provider-message-2" });
      if (url.endsWith("record_reminder_delivery")) return Response.json(true);
      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await deliverDueReminders(env);

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("records a retriable ledger failure when Resend rejects the delivery", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("claim_due_reminder_notifications")) return Response.json([reminder]);
      if (url.endsWith("reminder_claim_is_active")) return Response.json(true);
      if (url === "https://api.resend.com/emails") return new Response(null, { status: 503 });
      if (url.endsWith("record_reminder_failure")) return Response.json(true);
      throw new Error(`unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await deliverDueReminders(env);

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("fails closed for malformed claim payloads before contacting Resend", async () => {
    const fetchMock = vi.fn(async () => Response.json([{ notification_event_id: "missing-fields" }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deliverDueReminders(env)).rejects.toThrow("invalid_reminder_claim_response");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
