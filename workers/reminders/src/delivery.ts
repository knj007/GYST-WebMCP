type ReminderSecrets = {
  REMINDER_FROM_EMAIL: string;
  RESEND_API_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
};

type ReminderEnv = ReminderSecrets;
type ClaimedReminder = { notification_event_id: string; reminder_rule_id: string; recipient_email: string; scheduled_for: string };
type ResendResponse = { id: string };

const MAX_BATCH_SIZE = 25;
const CLAIM_TIMEOUT_SECONDS = 15 * 60;

function requireReminderSecrets(env: unknown): asserts env is ReminderEnv {
  if (typeof env !== "object" || env === null) throw new Error("missing_reminder_environment");
  const candidate = env as Partial<ReminderSecrets>;
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "REMINDER_FROM_EMAIL"] as const;
  for (const key of required) {
    if (typeof candidate[key] !== "string" || candidate[key].trim().length === 0) throw new Error(`missing_${key.toLowerCase()}`);
  }
}

function isClaimedReminder(value: unknown): value is ClaimedReminder {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.notification_event_id === "string" && candidate.notification_event_id.length > 0 && candidate.notification_event_id.length <= 256
    && typeof candidate.reminder_rule_id === "string" && candidate.reminder_rule_id.length > 0
    && typeof candidate.recipient_email === "string" && candidate.recipient_email.length > 0 && candidate.recipient_email.length <= 320
    && typeof candidate.scheduled_for === "string";
}

function errorCode(error: unknown): string {
  return (error instanceof Error ? error.message : "unknown_reminder_delivery_error").slice(0, 500);
}

async function postRpc(env: ReminderEnv, name: string, payload: object): Promise<unknown> {
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`supabase_${name}_${response.status}`);
  return response.json();
}

async function sendReminderEmail(env: ReminderEnv, reminder: ClaimedReminder): Promise<string> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": reminder.notification_event_id },
    body: JSON.stringify({ from: env.REMINDER_FROM_EMAIL, to: [reminder.recipient_email], subject: "Your GYST reminder", text: "A GYST reminder is due. Open GYST when you are ready.", html: "<p>A GYST reminder is due. Open GYST when you are ready.</p>" }),
  });
  if (!response.ok) throw new Error(`resend_${response.status}`);
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || Array.isArray(payload) || typeof (payload as ResendResponse).id !== "string" || (payload as ResendResponse).id.length === 0) throw new Error("resend_invalid_response");
  return (payload as ResendResponse).id;
}

export async function deliverDueReminders(env: unknown, now = new Date()): Promise<void> {
  requireReminderSecrets(env);
  const claimed = await postRpc(env, "claim_due_reminder_notifications", { p_now: now.toISOString(), p_batch_size: MAX_BATCH_SIZE, p_claim_timeout_seconds: CLAIM_TIMEOUT_SECONDS });
  if (!Array.isArray(claimed) || !claimed.every(isClaimedReminder)) throw new Error("invalid_reminder_claim_response");
  await Promise.all(claimed.map(async (reminder) => {
    try {
      const active = await postRpc(env, "reminder_claim_is_active", { p_notification_event_id: reminder.notification_event_id });
      if (active !== true) return;
      const providerMessageId = await sendReminderEmail(env, reminder);
      await postRpc(env, "record_reminder_delivery", { p_notification_event_id: reminder.notification_event_id, p_provider_message_id: providerMessageId });
    } catch (error) {
      try {
        await postRpc(env, "record_reminder_failure", { p_notification_event_id: reminder.notification_event_id, p_error_code: errorCode(error) });
      } catch (recordError) {
        console.error(JSON.stringify({ message: "reminder_failure_recording_failed", eventId: reminder.notification_event_id, error: errorCode(recordError) }));
      }
    }
  }));
}
