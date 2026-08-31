import Link from "next/link";
import { connection } from "next/server";

import { SignupForm } from "@/components/signup-form";
import { isSignupConfigured } from "@/lib/auth/signup";
import { readSupabasePublicConfig } from "@/lib/supabase/config";

export default async function SignupPage() {
  await connection();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const isConfigured = Boolean(siteKey && readSupabasePublicConfig() && isSignupConfigured());

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl place-items-center px-6 py-16">
      <section className="w-full max-w-md rounded-[2rem] border border-line bg-surface p-8 shadow-[0_24px_70px_rgba(28,40,34,0.08)] sm:p-10">
        <Link className="text-lg font-semibold tracking-tight" href="/">GYST</Link>
        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-accent">Private ledger</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Create your account.</h1>
        <p className="mt-3 leading-7 text-muted">Start with a protected account, then keep the final record human-owned.</p>
        {isConfigured && siteKey ? <SignupForm siteKey={siteKey} /> : <p className="mt-6 rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm leading-6">Signup is being activated. Please check back shortly.</p>}
        <p className="mt-6 text-sm text-muted">Already have an account? <Link className="font-medium text-foreground underline" href="/login">Sign in</Link>.</p>
      </section>
    </main>
  );
}
