import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/script", () => ({
  default: ({ onLoad }: { onLoad: () => void }) => <button data-testid="turnstile-script" onClick={onLoad} type="button">load</button>,
}));

import { SignupForm } from "@/components/signup-form";

afterEach(() => {
  cleanup();
  delete window.turnstile;
  vi.restoreAllMocks();
});

test("resets Turnstile after a failed signup response", async () => {
  const reset = vi.fn();
  let callback: ((token: string) => void) | undefined;
  window.turnstile = {
    render: (_container, options) => {
      callback = options.callback;
      return "widget-id";
    },
    reset,
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Complete a fresh verification challenge and try again." }), { status: 400 }));

  render(<SignupForm siteKey="public-site-key" />);
  fireEvent.click(screen.getByTestId("turnstile-script"));
  callback?.("fresh-token");
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "an-example-password" } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Create account" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  await waitFor(() => expect(reset).toHaveBeenCalledWith("widget-id"));
  expect(screen.getByText(/complete a fresh verification/i)).toBeDefined();
});

test("shows the confirmation result after successful signup", async () => {
  let callback: ((token: string) => void) | undefined;
  window.turnstile = {
    render: (_container, options) => {
      callback = options.callback;
      return "widget-id";
    },
    reset: vi.fn(),
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Check your email to confirm your account." }), { status: 200 }));

  render(<SignupForm siteKey="public-site-key" />);
  fireEvent.click(screen.getByTestId("turnstile-script"));
  callback?.("fresh-token");
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "an-example-password" } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Create account" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  await waitFor(() => expect(screen.getByText(/check your email/i)).toBeDefined());
});
