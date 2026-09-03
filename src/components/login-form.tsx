"use client";

import { useState } from "react";

import { TurnstileChallenge } from "@/components/turnstile-challenge";
import { signIn } from "@/lib/auth/actions";

export function LoginForm({ siteKey }: { siteKey?: string }) {
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");

  return (
    <form action={signIn} className="mt-8 space-y-5">
      <div>
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <input autoComplete="email" className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-accent" id="email" maxLength={320} name="email" required type="email" />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <input autoComplete="current-password" className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-accent" id="password" maxLength={1024} name="password" required type="password" />
      </div>
      {siteKey ? (
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
          siteKey={siteKey}
        />
      ) : null}
      {siteKey ? <input name="turnstileToken" type="hidden" value={token} /> : null}
      {message ? <p aria-live="polite" className="rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm leading-6">{message}</p> : null}
      <button className="w-full rounded-full bg-accent px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(siteKey) && !token} type="submit">
        Sign in
      </button>
    </form>
  );
}
