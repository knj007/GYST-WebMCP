"use client";

import Script from "next/script";
import { useRef, useState } from "react";

import { signIn } from "@/lib/auth/actions";

// `window.turnstile` is declared globally by the signup form, which renders the
// same explicit widget.

export function LoginForm({ siteKey }: { siteKey?: string }) {
  const widgetContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");

  function renderWidget() {
    if (!siteKey || !widgetContainer.current || widgetId.current || !window.turnstile) {
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

  return (
    <form action={signIn} className="mt-8 space-y-5">
      {siteKey ? <Script onLoad={renderWidget} src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" /> : null}
      <div>
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <input autoComplete="email" className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-accent" id="email" maxLength={320} name="email" required type="email" />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <input autoComplete="current-password" className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-accent" id="password" maxLength={1024} name="password" required type="password" />
      </div>
      {siteKey ? <div aria-label="Verification challenge" ref={widgetContainer} /> : null}
      {siteKey ? <input name="turnstileToken" type="hidden" value={token} /> : null}
      {message ? <p aria-live="polite" className="rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm leading-6">{message}</p> : null}
      <button className="w-full rounded-full bg-accent px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(siteKey) && !token} type="submit">
        Sign in
      </button>
    </form>
  );
}
