import { describe, expect, test } from "vitest";

import { foundingCommitmentLabel, previousCommitmentOptions } from "@/lib/rituals/daily-commitments";

const active = [
  { due_on: "2026-09-05", id: "c3000000-0000-4000-8000-000000000001", title: "Draft chapter one" },
  { due_on: null, id: "c3000000-0000-4000-8000-000000000002", title: "Call the printer" },
];
const founding = { due_on: null, id: "c3000000-0000-4000-8000-0000000000f1", title: "Founded this GYST ledger" };

describe("previous commitment options", () => {
  test("offers the founding commitment first, clearly labelled, on day one", () => {
    const options = previousCommitmentOptions({ active, founding, hasCommittedDaily: false });
    expect(options.map((option) => option.title)).toEqual([foundingCommitmentLabel, "Draft chapter one", "Call the printer"]);
    expect(options[0]?.id).toBe(founding.id);
  });

  test("drops the founding commitment once a daily ritual has been committed", () => {
    expect(previousCommitmentOptions({ active, founding, hasCommittedDaily: true })).toEqual(active);
  });

  test("leaves an owner with no onboarding row exactly as before", () => {
    expect(previousCommitmentOptions({ active, founding: null, hasCommittedDaily: false })).toEqual(active);
    expect(previousCommitmentOptions({ active, founding: null, hasCommittedDaily: true })).toEqual(active);
  });

  test("never lists the founding commitment twice", () => {
    const options = previousCommitmentOptions({ active: [...active, founding], founding, hasCommittedDaily: false });
    expect(options.filter((option) => option.id === founding.id)).toHaveLength(1);
  });
});
