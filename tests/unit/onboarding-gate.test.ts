import { describe, expect, test } from "vitest";

import { needsOnboarding, welcomeRedirect } from "@/lib/onboarding/gate";

describe("onboarding gate", () => {
  test("a missing profile row is not onboarded", () => {
    expect(needsOnboarding({ isDemo: false, profile: null })).toBe(true);
  });

  test("a profile without onboarded_at is not onboarded", () => {
    expect(needsOnboarding({ isDemo: false, profile: { onboarded_at: null } })).toBe(true);
  });

  test("a profile with onboarded_at is onboarded", () => {
    expect(needsOnboarding({ isDemo: false, profile: { onboarded_at: "2026-09-02T12:00:00Z" } })).toBe(false);
  });

  test("a demo session is never gated, even without a profile", () => {
    expect(needsOnboarding({ isDemo: true, profile: null })).toBe(false);
    expect(needsOnboarding({ isDemo: true, profile: { onboarded_at: null } })).toBe(false);
  });
});

describe("welcome stage redirects", () => {
  const pending = { isDemo: false, profile: null } as const;
  const onboarded = { isDemo: false, profile: { onboarded_at: "2026-09-02T12:00:00Z" } } as const;
  const demo = { isDemo: true, profile: { onboarded_at: "2026-09-02T12:00:00Z" } } as const;

  test("a demo session is sent to the ritual from every stage", () => {
    for (const stage of ["orientation", "goals", "review", "rhythm"] as const) {
      expect(welcomeRedirect({ ...demo, stage })).toBe("/daily");
    }
  });

  test("an owner who still needs onboarding may view the three pre-commit stages", () => {
    for (const stage of ["orientation", "goals", "review"] as const) {
      expect(welcomeRedirect({ ...pending, stage })).toBeNull();
    }
  });

  test("an onboarded owner is sent to the ritual from the pre-commit stages", () => {
    for (const stage of ["orientation", "goals", "review"] as const) {
      expect(welcomeRedirect({ ...onboarded, stage })).toBe("/daily");
    }
  });

  test("the rhythm stage is the one welcome page an onboarded owner may see", () => {
    expect(welcomeRedirect({ ...onboarded, stage: "rhythm" })).toBeNull();
    expect(welcomeRedirect({ ...pending, stage: "rhythm" })).toBe("/welcome");
  });

  test("the ritual layout and the welcome stages can never bounce each other", () => {
    // The ritual layout redirects to /welcome exactly when needsOnboarding is
    // true; the orientation stage then renders rather than redirecting back.
    for (const state of [pending, { isDemo: false, profile: { onboarded_at: null } }] as const) {
      expect(needsOnboarding(state)).toBe(true);
      expect(welcomeRedirect({ ...state, stage: "orientation" })).toBeNull();
    }
    // Neither an onboarded owner nor a demo session is redirected by the
    // ritual layout, so wherever a welcome stage sends them, /daily renders.
    expect(needsOnboarding(onboarded)).toBe(false);
    expect(welcomeRedirect({ ...onboarded, stage: "rhythm" })).toBeNull();
    expect(needsOnboarding(demo)).toBe(false);
    expect(welcomeRedirect({ ...demo, stage: "rhythm" })).toBe("/daily");
  });
});
