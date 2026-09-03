"use client";

import { FormEvent, useRef, useState } from "react";

import { TurnstileChallenge, type TurnstileChallengeHandle } from "@/components/turnstile-challenge";

export function SignupForm({ siteKey }: { siteKey: string }) {
  const challenge = useRef<TurnstileChallengeHandle>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState("");

  function resetChallenge() {
    setToken("");
    challenge.current?.reset();
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
      <div>
        <label className="text-sm font-medium" htmlFor="email">Email</label>
        <input autoComplete="email" className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-accent" id="email" maxLength={320} name="email" required type="email" />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <input autoComplete="new-password" className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-accent" id="password" maxLength={1024} minLength={8} name="password" required type="password" />
      </div>
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
      {message ? <p aria-live="polite" className="rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm leading-6">{message}</p> : null}
      <button className="w-full rounded-full bg-accent px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting || !token} type="submit">
        {submitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
