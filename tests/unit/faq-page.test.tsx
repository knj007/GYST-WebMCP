import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import FaqPage from "@/app/(marketing)/faq/page";
import { AuthenticatedHeader } from "@/components/authenticated-header";
import { SiteHeader } from "@/components/site-header";
import { submissionLinks } from "@/lib/submission-links";

const questionCount = 27;

afterEach(() => {
  cleanup();
});

test("answers the what, the WebMCP surface, the submission, and the agent clients", () => {
  render(<FaqPage />);

  expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/how GYST works/i);
  for (const heading of ["The basics", "WebMCP", "The challenge submission", "Using GYST with an agent"]) {
    expect(screen.getByRole("heading", { level: 2, name: heading })).toBeDefined();
  }
  for (const client of [/Claude in Chrome\?/, /ChatGPT or Codex\?/, /Gemini\?/, /Which browsers and agents/]) {
    expect(screen.getByRole("heading", { level: 3, name: client })).toBeDefined();
  }
});

test("keeps every answer collapsed behind its own disclosure", () => {
  const { container } = render(<FaqPage />);
  const items = container.querySelectorAll("details");

  expect(items).toHaveLength(questionCount);
  for (const item of items) {
    expect(item.open).toBe(false);
    // The question has to be a heading, or a screen reader cannot navigate the
    // page by question the way a sighted reader scans the closed rows.
    expect(within(item).getByRole("heading", { level: 3 })).toBeDefined();
  }
});

test("points at the published entry, video, and public repository", () => {
  render(<FaqPage />);

  expect(screen.getByRole("link", { name: /view the entry/i }).getAttribute("href")).toBe(
    "https://devpost.com/software/gyst-get-your-stuff-together",
  );
  expect(screen.getByRole("link", { name: /watch the walkthrough/i }).getAttribute("href")).toBe(
    "https://youtu.be/ao5oraM6PO0",
  );
  expect(screen.getAllByRole("link", { name: /github\.com\/knj007\/GYST-WebMCP/i })[0]?.getAttribute("href")).toBe(
    submissionLinks.repository,
  );
});

test("is reachable from both the public and the authenticated header", () => {
  render(<SiteHeader />);
  expect(screen.getByRole("link", { name: "FAQ" }).getAttribute("href")).toBe("/faq");
  cleanup();

  render(<AuthenticatedHeader displayName="Fictional Owner" />);
  expect(screen.getByRole("link", { name: "FAQ" }).getAttribute("href")).toBe("/faq");
});

test("states the commit boundary rather than implying an agent could commit", () => {
  render(<FaqPage />);

  expect(screen.getByText(/no commit, delete, export, history, or SQL tool/i)).toBeDefined();
  // A page-driving agent operates the browser as the owner, so the missing
  // commit tool does not restrain it. The FAQ must say so.
  expect(screen.getByText(/it can press the commit button/i)).toBeDefined();
});

test("does not claim a test gates the build, because none does", () => {
  const { container } = render(<FaqPage />);
  const packageJson = readFileSync(join(process.cwd(), "package.json"), "utf8");

  // The capability-contract test guards npm test, not next build: there is no
  // prebuild hook and no CI workflow. Saying otherwise on a public page would
  // promise judges an enforcement that does not exist.
  expect(packageJson).not.toContain('"prebuild"');
  expect(container.textContent).not.toMatch(/fails the build/i);
});

test("keeps the published tool counts equal to the tools actually registered", () => {
  const { container } = render(<FaqPage />);
  const prose = container.textContent ?? "";
  const source = readFileSync(join(process.cwd(), "src", "components", "webmcp-tools.tsx"), "utf8");
  const siteSource = readFileSync(join(process.cwd(), "src", "lib", "webmcp", "site-tools-script.ts"), "utf8");

  const group = (name: string) => source.slice(source.indexOf(`const ${name}: WebMcpTool[] = [`), source.indexOf(`];`, source.indexOf(`const ${name}: WebMcpTool[] = [`)));
  const counts = ["dailyTools", "weeklyTools", "onboardingTools"].map((name) => {
    const block = group(name);
    const total = (block.match(/(?:name: |mutation\()"gyst\./g) ?? []).length;
    const read = (block.match(/readOnlyHint: true/g) ?? []).length;
    return { draft: total - read, read, total };
  });
  const siteTools = (siteSource.match(/name: "gyst\./g) ?? []).length;
  const [daily, weekly, onboarding] = counts;

  expect(daily).toEqual({ draft: 5, read: 2, total: 7 });
  expect(weekly).toEqual({ draft: 5, read: 2, total: 7 });
  expect(onboarding).toEqual({ draft: 4, read: 1, total: 5 });
  expect(siteTools).toBe(3);

  const total = siteTools + counts.reduce((sum, entry) => sum + entry.total, 0);
  expect(total).toBe(22);
  expect(prose).toContain("Twenty-two.");
  expect(prose).toContain("Three site-wide");
  expect(prose).toContain("Seven on the daily ritual — two read, five draft.");
  expect(prose).toContain("Seven on the weekly review — two read, five draft.");
  expect(prose).toContain("Five on first-run onboarding — one read, four draft.");
});
