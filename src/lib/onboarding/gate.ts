// The onboarding gate. It reads nothing; the callers already hold the profile.
//
// Completion is decided by `profiles.onboarded_at` alone. A missing profile row
// is not onboarded: a signed-up owner has no row until the founding commit
// creates one. A demo session is never gated; its seed marks it onboarded and
// the welcome pages refuse it regardless.

export type OnboardingGateProfile = { onboarded_at: string | null } | null;

export type OnboardingGateInput = {
  isDemo: boolean;
  profile: OnboardingGateProfile;
};

export type WelcomeStage = "orientation" | "goals" | "review" | "rhythm";

export function needsOnboarding({ isDemo, profile }: OnboardingGateInput): boolean {
  if (isDemo) return false;
  return profile === null || profile.onboarded_at === null;
}

/**
 * Where a welcome page sends the current identity, or null to render it.
 *
 * The three pre-commit stages belong to an owner who still needs onboarding;
 * anyone else goes to the ritual. The rhythm stage is the one welcome page an
 * onboarded owner may see, so it sends an unfinished owner back to the start.
 * The ritual layout only redirects when `needsOnboarding` is true, and the
 * welcome stages only redirect away when it is false, so no loop exists.
 */
export function welcomeRedirect({ isDemo, profile, stage }: OnboardingGateInput & { stage: WelcomeStage }): "/daily" | "/welcome" | null {
  if (isDemo) return "/daily";
  const pending = needsOnboarding({ isDemo, profile });
  if (stage === "rhythm") return pending ? "/welcome" : null;
  return pending ? null : "/daily";
}
