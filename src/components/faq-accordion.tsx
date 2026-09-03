import type { ReactNode } from "react";

/**
 * Native disclosure accordion. `details`/`summary` keeps every answer keyboard
 * reachable, findable by in-page search when open, and readable with no
 * client JavaScript, which matters on a page people reach when something is
 * already not working for them.
 */
export function FaqAccordion({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-line bg-surface">
      {children}
    </div>
  );
}

export function FaqItem({ children, question }: { children: ReactNode; question: string }) {
  return (
    <details className="group border-b border-line last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 marker:content-none [&::-webkit-details-marker]:hidden">
        <h3 className="font-medium">{question}</h3>
        <span aria-hidden="true" className="shrink-0 text-xl leading-none text-accent transition-transform duration-200 group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="space-y-4 px-6 pb-6 text-[0.95rem] leading-7 text-muted">{children}</div>
    </details>
  );
}
