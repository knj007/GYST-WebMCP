import { describe, expect, test } from "vitest";

import { enumValue, optionalText, requiredUuid } from "@/lib/webmcp/contracts";

describe("WebMCP input contracts", () => {
  test("rejects oversized text before a draft endpoint can write", () => {
    expect(() => optionalText("x".repeat(12001), 12000, "text")).toThrow("no longer than 12000");
  });

  test("rejects unsupported enums and malformed commitment ids", () => {
    expect(() => enumValue("sideways", ["up", "steady", "down"] as const, "arrow")).toThrow("arrow is invalid");
    expect(() => requiredUuid("not-a-uuid", "commitment_id")).toThrow("commitment_id must be a UUID");
  });
});
