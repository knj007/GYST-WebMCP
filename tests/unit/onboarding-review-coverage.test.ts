import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

// Every draft field an onboarding tool can set must be visible on the review
// page before the owner commits it, and editable on the goals form so a hand
// re-save never silently drops agent text. This test reads the tool schemas
// so a field added to a propose tool without review coverage fails here.
const root = process.cwd();
const registration = readFileSync(join(root, "src", "components", "webmcp-tools.tsx"), "utf8");
const reviewPage = readFileSync(join(root, "src", "app", "(welcome)", "welcome", "review", "page.tsx"), "utf8");
const goalsForm = readFileSync(join(root, "src", "components", "onboarding-draft-form.tsx"), "utf8");

const collections = {
  areas: { form: "areas", handle: /^key$/, variable: "area" },
  commitments: { form: "commitments", handle: /^goal_key$/, variable: "commitment" },
  goals: { form: "goals", handle: /^(?:key|area_key)$/, variable: "goal" },
  key_dates: { form: "key_dates", handle: /^goal_key$/, variable: "keyDate" },
} as const;

// Extract the top-level property names of `entries(max, min, { ... }, [...])`
// for one collection, walking braces so nested schemas such as `priority:
// { type: "integer" }` do not end the scan early.
function proposedFields(collection: keyof typeof collections): string[] {
  const start = registration.indexOf(`{ ${collection}: entries(`);
  if (start === -1) throw new Error(`No propose schema found for ${collection}.`);
  const open = registration.indexOf("{", registration.indexOf("entries(", start) + "entries(".length);
  let depth = 0;
  let end = -1;
  for (let index = open; index < registration.length; index += 1) {
    if (registration[index] === "{") depth += 1;
    if (registration[index] === "}") depth -= 1;
    if (depth === 0) { end = index; break; }
  }
  if (end === -1) throw new Error(`Unbalanced propose schema for ${collection}.`);
  let properties = registration.slice(open + 1, end);
  for (let previous = ""; previous !== properties;) {
    previous = properties;
    properties = properties.replace(/\{[^{}]*\}/g, "").replace(/\[[^[\]]*\]/g, "");
  }
  return Array.from(properties.matchAll(/(?:^|,)\s*([a-z_]+):/g), (field) => field[1]).filter((field): field is string => typeof field === "string");
}

describe("onboarding review covers every agent-settable field", () => {
  for (const collection of Object.keys(collections) as Array<keyof typeof collections>) {
    const { form, handle, variable } = collections[collection];

    test(`${collection}: the schema is readable and non-trivial`, () => {
      const fields = proposedFields(collection);
      expect(fields.length).toBeGreaterThan(1);
      expect(fields).toContain("title");
    });

    test(`${collection}: every non-handle field is rendered on the review page and editable on the goals form`, () => {
      for (const field of proposedFields(collection)) {
        if (handle.test(field)) continue;
        expect(reviewPage, `review page does not render ${variable}.${field}`).toMatch(new RegExp(`\\b${variable}\\.${field}\\b`));
        expect(goalsForm, `goals form has no input named ${form}.N.${field}`).toContain(`name={\`${form}.\${index}.${field}\`}`);
      }
    });
  }

  test("relation handles are rendered by grouping rather than as raw keys", () => {
    expect(reviewPage).toContain("goal.area_key === area.key");
    expect(reviewPage).toContain("item.goal_key === goalKey");
  });
});
