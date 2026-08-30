import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl font-semibold">That page is not part of this ritual.</h1>
      <Link className="mt-6 inline-block font-medium text-accent" href="/">Return home</Link>
    </main>
  );
}
