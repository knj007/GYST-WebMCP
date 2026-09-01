export function DemoBanner() {
  return (
    <div className="border-b border-line bg-accent-soft">
      <p className="mx-auto max-w-6xl px-6 py-3 text-sm leading-6">
        <span className="font-semibold">Demo session.</span> This ledger is fictional and belongs
        only to this browser. Commit records freely — nothing here is shared with another visitor,
        and committed records stay immutable. Sign out to end the session; it cannot be reopened.
      </p>
    </div>
  );
}
