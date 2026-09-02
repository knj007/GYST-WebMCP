import Link from "next/link";
import { connection } from "next/server";

import { LoginForm } from "@/components/login-form";
import { readSupabasePublicConfig } from "@/lib/supabase/config";

type LoginPageProps = {
  searchParams: Promise<{ deleted?: string; error?: string; reason?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await connection();
  const { deleted, error, reason } = await searchParams;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const isConfigured = Boolean(readSupabasePublicConfig());
  const message =
    deleted === "1"
      ? "Your account and its ledger records have been permanently deleted."
      : reason === "configuration" || !isConfigured
      ? "Sign-in is ready, but this environment does not have its public Supabase connection configured."
      : error === "challenge"
        ? "Complete a fresh verification challenge and try again."
        : error
          ? "We could not sign you in with those credentials."
          : null;

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl place-items-center px-6 py-16">
      <section className="w-full max-w-md rounded-[2rem] border border-line bg-surface p-8 shadow-[0_24px_70px_rgba(28,40,34,0.08)] sm:p-10">
        <Link className="text-lg font-semibold tracking-tight" href="/">
          GYST
        </Link>
        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-accent">
          Private ledger
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Welcome back.</h1>
        <p className="mt-3 leading-7 text-muted">
          Sign in to continue your daily or weekly ritual. New here? <Link className="font-medium text-foreground underline" href="/signup">Create an account</Link>.
        </p>

        {message ? (
          <p className="mt-6 rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm leading-6">
            {message}
          </p>
        ) : null}

        {isConfigured ? <LoginForm siteKey={siteKey} /> : null}
      </section>
    </main>
  );
}
