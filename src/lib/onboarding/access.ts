import "server-only";

import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/session";
import { type WelcomeStage, welcomeRedirect } from "@/lib/onboarding/gate";

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
