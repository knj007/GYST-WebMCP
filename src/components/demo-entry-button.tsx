"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      sitekey: string;
    },
  ) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const demoDestinations = ["/daily", "/weekly"] as const;

export function DemoEntryButton({ siteKey }: { siteKey: string }) {
  const router = useRouter();
  const widgetContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const [token, setToken] = useState("");

  function resetChallenge() {
    setToken("");
    if (widgetId.current) {
      window.turnstile?.reset(widgetId.current);
    }
  }

  function renderWidget() {
    if (!widgetContainer.current || widgetId.current || !window.turnstile) {
      return;
    }

    widgetId.current = window.turnstile.render(widgetContainer.current, {
      callback: (nextToken) => {
        setMessage("");
        setToken(nextToken);
      },
      "error-callback": () => {
        setToken("");
        setMessage("Verification could not be completed. Please try again.");
      },
      "expired-callback": () => {
        setToken("");
        setMessage("Verification expired. Please complete the fresh challenge.");
      },
      sitekey: siteKey,
    });
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
      <Script
        onLoad={renderWidget}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <button
        className="rounded-full bg-accent px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={starting || !token}
        onClick={start}
        type="button"
      >
        {starting ? "Preparing the demo…" : "Open the demo"}
      </button>
      <div aria-label="Verification challenge" ref={widgetContainer} />
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
