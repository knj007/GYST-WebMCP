"use client";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl font-semibold">The ritual hit a snag.</h1>
      <p className="mt-4 text-muted">Nothing was committed. You can safely try this view again.</p>
      <button className="mt-7 rounded-full bg-accent px-5 py-3 font-medium text-white" onClick={reset} type="button">
        Try again
      </button>
    </main>
  );
}
