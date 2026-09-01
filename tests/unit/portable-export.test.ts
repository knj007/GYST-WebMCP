import { describe, expect, test } from "vitest";

import { createMarkdownExport, createPortableExport, type ExportClient } from "@/lib/export/portable";

const ownerId = "11111111-1111-4111-8111-111111111111";

function exportClient(): ExportClient {
  const rows = {
    daily_entries: [{ ritual_session_id: "daily-committed", moved_text: "Closed <script>alert(1)</script>", blocker_text: "A *real* blocker", blocker_type: "capacity", previous_commitment_id: null, previous_commitment_outcome: "done", next_commitment_id: null, optional_context: "Line one\nLine two", buried_win: null, is_sensitive: false }],
    ritual_sessions: [
      { id: "daily-committed", kind: "daily", period_start: "2026-09-01", status: "committed", committed_at: "2026-09-02T01:00:00.000Z" },
      { id: "weekly-committed", kind: "weekly", period_start: "2026-09-01", status: "committed", committed_at: "2026-09-08T01:00:00.000Z" },
      { id: "daily-draft", kind: "daily", period_start: "2026-09-09", status: "draft", committed_at: null },
    ],
    weekly_entries: [{ ritual_session_id: "weekly-committed", missing_metrics: [], observations: [{ text: "Progress & momentum" }], decision_text: "Keep going", arrow: "up", priorities: [{ title: "Ship safely", due_on: "2026-09-12" }] }],
  };
  return {
    from(table) {
      let status: string | undefined;
      const result = () => ({
        data: table === "ritual_sessions" && status === "committed" ? rows.ritual_sessions.filter((row) => row.status === "committed") : rows[table],
        error: null,
      });
      const chain = {
        eq(column: string, value: string) {
          if (column === "status") status = value;
          return chain;
        },
        order() { return Promise.resolve(result()); },
      };
      return { select: () => chain };
    },
  } as ExportClient;
}

describe("portable exports", () => {
  test("matches owner-scoped fixture counts and keeps drafts out of the default export", async () => {
    const portable = await createPortableExport(exportClient(), ownerId, false, "2026-09-10T00:00:00.000Z");
    expect(portable).toMatchObject({ format: "gyst-portable-v1", schemaVersion: 1, exportedAt: "2026-09-10T00:00:00.000Z", exportScope: "committed-records" });
    expect(portable.rituals).toHaveLength(2);
    expect(portable.rituals.map((ritual) => ritual.kind)).toEqual(["daily", "weekly"]);
    expect(portable.rituals.some((ritual) => ritual.status === "draft")).toBe(false);
  });

  test("includes draft rows only in an explicit full backup", async () => {
    const portable = await createPortableExport(exportClient(), ownerId, true, "2026-09-10T00:00:00.000Z");
    expect(portable.exportScope).toBe("full-backup");
    expect(portable.rituals).toHaveLength(3);
    expect(portable.rituals.find((ritual) => ritual.status === "draft")?.periodStart).toBe("2026-09-09");
  });

  test("renders a readable archive and escapes user Markdown and HTML", async () => {
    const portable = await createPortableExport(exportClient(), ownerId, false, "2026-09-10T00:00:00.000Z");
    const markdown = createMarkdownExport(portable);
    expect(markdown).toContain("# GYST archive");
    expect(markdown).toContain("## Daily ritual — 2026-09-01");
    expect(markdown).toContain("&lt;script&gt;alert\\(1\\)&lt;/script&gt;");
    expect(markdown).toContain("A \\*real\\* blocker");
    expect(markdown).toContain("Line one  \nLine two");
    expect(markdown).toContain("## Weekly ritual — 2026-09-01");
  });
});
