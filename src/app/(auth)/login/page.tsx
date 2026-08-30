import Link from "next/link";

import { signIn } from "@/lib/auth/actions";
import { readSupabasePublicConfig } from "@/lib/supabase/config";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; reason?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, reason } = await searchParams;
  const isConfigured = Boolean(readSupabasePublicConfig());
  const message =
    reason === "configuration" || !isConfigured
      ? "Sign-in is ready, but this environment does not have its public Supabase connection configured."
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
          Sign in to continue your daily or weekly ritual. Public signup arrives later with abuse protection.
        </p>

        {message ? (
          <p className="mt-6 rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm leading-6">
            {message}
          </p>
        ) : null}

        <form action={signIn} className="mt-8 space-y-5">
          <div>
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="email"
              className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-accent"
              id="email"
              maxLength={320}
              name="email"
              required
              type="email"
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-accent"
              id="password"
              maxLength={1024}
              name="password"
              required
              type="password"
            />
          </div>
          <button
            className="w-full rounded-full bg-accent px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isConfigured}
            type="submit"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
