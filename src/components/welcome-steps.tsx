"use client";

import { usePathname } from "next/navigation";

export const welcomeSteps = [
  { href: "/welcome", label: "Welcome" },
  { href: "/welcome/goals", label: "Goals" },
  { href: "/welcome/review", label: "Review" },
  { href: "/welcome/rhythm", label: "Rhythm" },
] as const;

export function WelcomeSteps() {
  const pathname = usePathname();
  const currentIndex = Math.max(0, welcomeSteps.findIndex((step) => step.href === pathname));

  return (
    <ol aria-label="Onboarding steps" className="flex flex-wrap items-center gap-4 text-sm">
      {welcomeSteps.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        return (
          <li
            aria-current={state === "current" ? "step" : undefined}
            className={state === "current" ? "font-semibold text-foreground" : state === "done" ? "text-accent" : "text-muted"}
            key={step.href}
          >
            <span className="mr-1 tabular-nums">{index + 1}.</span>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
