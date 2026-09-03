import "server-only";

import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/session";
import { type WelcomeStage, needsOnboarding, welcomeRedirect } from "@/lib/onboarding/gate";

/**
 * Admit only an owner whose ledger is founded (or a demo session) to a ritual
 * page; a new owner is sent to the welcome pages instead. The ritual layout
 * does not hold this gate, so `/settings/account` stays reachable before
 * onboarding and account deletion is never blocked behind founding a ledger.
 */
export async function requireOnboarded() {
  const state = await getCurrentProfile();

  if (needsOnboarding({ isDemo: state.identity.isDemo, profile: state.profile })) {
    redirect("/welcome");
  }

  return state;
}

/**
 * Admit the current identity to one welcome stage or send it where it belongs.
 *
 * Layouts cannot see the pathname, so each welcome page names its own stage.
 * `getCurrentProfile` is request-cached, so this costs no extra query.
 */
export async function requireWelcomeStage(stage: WelcomeStage) {
  const state = await getCurrentProfile();
  const destination = welcomeRedirect({ isDemo: state.identity.isDemo, profile: state.profile, stage });

  if (destination) {
    redirect(destination);
  }

  return state;
}
