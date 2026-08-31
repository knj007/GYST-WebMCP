"use client";

import Script from "next/script";
import { FormEvent, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    callback: (token: string) => void;
    "error-callback": () => void;
    "expired-callback": () => void;
    sitekey: string;
  }) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function SignupForm({ siteKey }: { siteKey: string }) {
  const widgetContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!token) {
      setMessage("Complete the verification challenge before creating your account.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    const form = new FormData(formElement);
    const response = await fetch("/api/auth/signup", {
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        turnstileToken: token,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);

    if (!response) {
      resetChallenge();
      setMessage("Signup is temporarily unavailable. Please try again.");
      setSubmitting(false);
      return;
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      resetChallenge();
      setMessage(payload?.message ?? "Signup could not be completed. Please try again.");
      setSubmitting(false);
      return;
    }

    setMessage(payload?.message ?? "Check your email to confirm your account.");
    formElement.reset();
    setSubmitting(false);
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <Script onLoad={renderWidget} src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div>
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <input autoComplete="email" className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-accent" id="email" maxLength={320} name="email" required type="email" />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <input autoComplete="new-password" className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-accent" id="password" maxLength={1024} minLength={8} name="password" required type="password" />
      </div>
      <div aria-label="Verification challenge" ref={widgetContainer} />
      {message ? <p aria-live="polite" className="rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm leading-6">{message}</p> : null}
      <button className="w-full rounded-full bg-accent px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting || !token} type="submit">
        {submitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
