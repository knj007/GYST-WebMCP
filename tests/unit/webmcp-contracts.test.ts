import { describe, expect, test } from "vitest";

import { enumValue, optionalText, requiredUuid } from "@/lib/webmcp/contracts";
import { dailyAgentBrief, weeklyAgentBrief } from "@/lib/webmcp/briefs";

describe("WebMCP input contracts", () => {
  test("rejects oversized text before a draft endpoint can write", () => {
    expect(() => optionalText("x".repeat(12001), 12000, "text")).toThrow("no longer than 12000");
  });

  test("rejects unsupported enums and malformed commitment ids", () => {
    expect(() => enumValue("sideways", ["up", "steady", "down"] as const, "arrow")).toThrow("arrow is invalid");
    expect(() => requiredUuid("not-a-uuid", "commitment_id")).toThrow("commitment_id must be a UUID");
  });

  test("provides a bounded, non-mutating opening brief for each ritual", () => {
    expect(dailyAgentBrief.opening).toMatch(/ready for today’s check-in/i);
    expect(dailyAgentBrief.suggested_questions).toContain("What moved today?");
    expect(weeklyAgentBrief.opening).toMatch(/ready for their weekly check-in/i);
    expect(weeklyAgentBrief.suggested_questions).toHaveLength(3);
  });
});
