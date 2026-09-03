"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { TurnstileChallenge, type TurnstileChallengeHandle } from "@/components/turnstile-challenge";

const demoDestinations = ["/daily"] as const;

export function DemoEntryButton({ siteKey }: { siteKey: string }) {
  const router = useRouter();
  const challenge = useRef<TurnstileChallengeHandle>(null);
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const [token, setToken] = useState("");

  function resetChallenge() {
    setToken("");
    challenge.current?.reset();
  }

  async function start() {
    if (!token) {
      setMessage("Complete the verification challenge to open the demo.");
      return;
    }

    setStarting(true);
    setMessage("");
    const response = await fetch("/api/demo/start", {
      body: JSON.stringify({ turnstileToken: token }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);

    const payload = (await response?.json().catch(() => null)) as
      | { message?: string; redirectTo?: string }
      | null;

    // Only a known ritual route is followed, so a malformed or unexpected
    // response cannot redirect the visitor somewhere arbitrary.
    const destination = demoDestinations.find((route) => route === payload?.redirectTo);

    if (!response?.ok || !destination) {
      resetChallenge();
      setMessage(payload?.message ?? "The demo is temporarily unavailable. Please try again.");
      setStarting(false);
      return;
    }

    router.push(destination);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <button
        className="rounded-full bg-accent px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={starting || !token}
        onClick={start}
        type="button"
      >
        {starting ? "Preparing the demo…" : "Open the demo"}
      </button>
      <TurnstileChallenge
        onError={() => {
          setToken("");
          setMessage("Verification could not be completed. Please try again.");
        }}
        onExpire={() => {
          setToken("");
          setMessage("Verification expired. Please complete the fresh challenge.");
        }}
        onToken={(nextToken) => {
          setMessage("");
          setToken(nextToken);
        }}
        ref={challenge}
        siteKey={siteKey}
      />
      {message ? (
        <p
          aria-live="polite"
          className="rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm leading-6"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
