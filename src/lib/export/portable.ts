import "server-only";

import type { Database, Json } from "@/lib/db/database.types";

export type ExportClient = {
  from: <Table extends "daily_entries" | "ritual_sessions" | "weekly_entries">(table: Table) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          order: (column: string, options?: { ascending?: boolean }) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
        };
        order: (column: string, options?: { ascending?: boolean }) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
};

type DailyRow = Pick<Database["public"]["Tables"]["daily_entries"]["Row"], "blocker_text" | "blocker_type" | "buried_win" | "is_sensitive" | "moved_text" | "next_commitment_id" | "optional_context" | "previous_commitment_id" | "previous_commitment_outcome" | "ritual_session_id">;
type WeeklyRow = Pick<Database["public"]["Tables"]["weekly_entries"]["Row"], "arrow" | "decision_text" | "missing_metrics" | "observations" | "priorities" | "ritual_session_id">;
type SessionRow = Pick<Database["public"]["Tables"]["ritual_sessions"]["Row"], "committed_at" | "id" | "kind" | "period_start" | "status">;

export type PortableRitual = {
  committedAt: string | null;
  daily: Omit<DailyRow, "ritual_session_id"> | null;
  kind: "daily" | "weekly";
  periodStart: string;
  status: "committed" | "draft";
  weekly: Omit<WeeklyRow, "ritual_session_id"> | null;
};

export type PortableExport = {
  exportScope: "committed-records" | "full-backup";
  exportedAt: string;
  format: "gyst-portable-v1";
  schemaVersion: 1;
  rituals: PortableRitual[];
};

function fail(error: { message: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

function objectRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export async function createPortableExport(
  client: ExportClient,
  userId: string,
  includeDrafts: boolean,
  exportedAt = new Date().toISOString(),
): Promise<PortableExport> {
  const sessionQuery = client.from("ritual_sessions").select("id, kind, period_start, status, committed_at").eq("user_id", userId);
  const [sessionsResult, dailyResult, weeklyResult] = await Promise.all([
    includeDrafts
      ? sessionQuery.order("period_start", { ascending: true })
      : sessionQuery.eq("status", "committed").order("period_start", { ascending: true }),
    client.from("daily_entries").select("ritual_session_id, moved_text, blocker_text, blocker_type, previous_commitment_id, previous_commitment_outcome, next_commitment_id, optional_context, buried_win, is_sensitive").eq("user_id", userId).order("created_at", { ascending: true }),
    client.from("weekly_entries").select("ritual_session_id, missing_metrics, observations, decision_text, arrow, priorities").eq("user_id", userId).order("created_at", { ascending: true }),
  ]);

  if (sessionsResult.error) fail(sessionsResult.error, "Unable to load ritual records for export.");
  if (dailyResult.error) fail(dailyResult.error, "Unable to load daily records for export.");
  if (weeklyResult.error) fail(weeklyResult.error, "Unable to load weekly records for export.");

  const dailyBySession = new Map(objectRows<DailyRow>(dailyResult.data).map((row) => {
    const { ritual_session_id, ...entry } = row;
    return [ritual_session_id, entry] as const;
  }));
  const weeklyBySession = new Map(objectRows<WeeklyRow>(weeklyResult.data).map((row) => {
    const { ritual_session_id, ...entry } = row;
    return [ritual_session_id, entry] as const;
  }));

  return {
    exportScope: includeDrafts ? "full-backup" : "committed-records",
    exportedAt,
    format: "gyst-portable-v1",
    schemaVersion: 1,
    rituals: objectRows<SessionRow>(sessionsResult.data).map((session) => ({
      committedAt: session.committed_at,
      daily: session.kind === "daily" ? dailyBySession.get(session.id) ?? null : null,
      kind: session.kind,
      periodStart: session.period_start,
      status: session.status,
      weekly: session.kind === "weekly" ? weeklyBySession.get(session.id) ?? null : null,
    })),
  };
}

function markdownText(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([\\`*_{}\[\]()#+\-.!|])/g, "\\$1")
    .replace(/\r?\n/g, "  \n");
}

function jsonLines(value: Json) {
  if (!Array.isArray(value) || value.length === 0) return "—";
  return value.map((item) => `- ${markdownText(JSON.stringify(item))}`).join("\n");
}

export function createMarkdownExport(portable: PortableExport) {
  const lines = [
    "# GYST archive",
    "",
    `Exported: ${portable.exportedAt}`,
    `Scope: ${portable.exportScope === "full-backup" ? "Full backup (committed records and drafts)" : "Committed records only"}`,
    "",
  ];

  for (const ritual of portable.rituals) {
    lines.push(`## ${ritual.kind === "daily" ? "Daily" : "Weekly"} ritual — ${ritual.periodStart}`, "");
    lines.push(`Status: ${ritual.status}`, "");
    if (ritual.daily) {
      lines.push(`**What moved:** ${markdownText(ritual.daily.moved_text)}`, "");
      lines.push(`**Blocker (${ritual.daily.blocker_type ?? "not recorded"}):** ${markdownText(ritual.daily.blocker_text)}`, "");
      lines.push(`**Previous commitment outcome:** ${ritual.daily.previous_commitment_outcome ?? "not recorded"}`, "");
      lines.push(`**Context:** ${markdownText(ritual.daily.optional_context)}`, "");
      lines.push(`**Buried win:** ${markdownText(ritual.daily.buried_win)}`, "");
      lines.push(`**Sensitive note:** ${ritual.daily.is_sensitive ? "Yes" : "No"}`, "");
    }
    if (ritual.weekly) {
      lines.push(`**Decision:** ${markdownText(ritual.weekly.decision_text)}`, "");
      lines.push(`**Arrow:** ${ritual.weekly.arrow ?? "not recorded"}`, "");
      lines.push("**Observations:**", jsonLines(ritual.weekly.observations), "");
      lines.push("**Missing metrics:**", jsonLines(ritual.weekly.missing_metrics), "");
      lines.push("**Priorities:**", jsonLines(ritual.weekly.priorities), "");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
