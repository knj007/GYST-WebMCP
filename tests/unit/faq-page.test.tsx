import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import FaqPage from "@/app/(marketing)/faq/page";
import { submissionLinks } from "@/lib/submission-links";

afterEach(() => {
  cleanup();
});

test("answers the what, the WebMCP surface, the submission, and the agent clients", () => {
  render(<FaqPage />);

  expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/how GYST works/i);
  for (const heading of ["The basics", "WebMCP", "The challenge submission", "Using GYST with an agent"]) {
    expect(screen.getByRole("heading", { level: 2, name: heading })).toBeDefined();
  }
  expect(screen.getByText(/Which browsers and agents can see the tools today\?/)).toBeDefined();
  expect(screen.getByText(/How do I use GYST with Claude in Chrome\?/)).toBeDefined();
  expect(screen.getByText(/How do I use GYST with ChatGPT or Codex\?/)).toBeDefined();
  expect(screen.getByText(/How do I use GYST with Gemini\?/)).toBeDefined();
});

test("keeps every answer collapsed behind its own disclosure", () => {
  const { container } = render(<FaqPage />);
  const items = container.querySelectorAll("details");

  expect(items.length).toBeGreaterThan(15);
  for (const item of items) {
    expect(item.open).toBe(false);
    expect(item.querySelector("summary")).not.toBeNull();
  }
});

test("points at the published entry, video, and public repository", () => {
  render(<FaqPage />);

  expect(screen.getByRole("link", { name: /view the entry/i }).getAttribute("href")).toBe(submissionLinks.devpostEntry);
  expect(screen.getByRole("link", { name: /watch the walkthrough/i }).getAttribute("href")).toBe(submissionLinks.demoVideo);
  expect(screen.getAllByRole("link", { name: /github\.com\/knj007\/GYST-WebMCP/i })[0]?.getAttribute("href")).toBe(
    submissionLinks.repository,
  );
});

test("states the commit boundary rather than implying an agent could commit", () => {
  render(<FaqPage />);

  expect(screen.getByText(/no commit, delete, export, history, or SQL tool/i)).toBeDefined();
  // A page-driving agent operates the browser as the owner, so the missing
  // commit tool does not restrain it. The FAQ must say so.
  expect(screen.getByText(/it can press the commit button/i)).toBeDefined();
});
