import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { markAgentDraftFields, useAgentDraftFields } from "@/lib/webmcp/draft-provenance";

function ProvenanceFixture({ ritualKey }: { ritualKey: string }) {
  const provenance = useAgentDraftFields(ritualKey);
  return <><p>{provenance.agentUpdated("decision_text") ? "agent marked" : "not marked"}</p><button onClick={() => provenance.clearHumanEdit("decision_text")}>Review field</button></>;
}

describe("agent draft provenance", () => {
  test("marks an agent-written field until the person edits it", () => {
    const ritualKey = "weekly:provenance-test";
    markAgentDraftFields(ritualKey, ["decision_text"]);
    render(<ProvenanceFixture ritualKey={ritualKey} />);
    expect(screen.getByText("agent marked")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Review field" }));
    expect(screen.getByText("not marked")).toBeTruthy();
  });
});
