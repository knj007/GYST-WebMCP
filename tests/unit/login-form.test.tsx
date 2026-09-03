import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/script", () => ({
  default: ({ onLoad }: { onLoad: () => void }) => <button data-testid="turnstile-script" onClick={onLoad} type="button">load</button>,
}));

vi.mock("@/lib/auth/actions", () => ({ signIn: vi.fn() }));

import { LoginForm } from "@/components/login-form";

afterEach(() => {
  cleanup();
  delete window.turnstile;
  vi.restoreAllMocks();
});

function mountWidget() {
  let callback: ((token: string) => void) | undefined;
  window.turnstile = {
    remove: vi.fn(),
    render: (_container, options) => {
      callback = options.callback;
      return "widget-id";
    },
    reset: vi.fn(),
  };
  return () => callback;
}

test("carries a solved Turnstile token into the sign-in submission", async () => {
  const getCallback = mountWidget();
  const { container } = render(<LoginForm siteKey="public-site-key" />);
  fireEvent.click(screen.getByTestId("turnstile-script"));

  const hidden = () => container.querySelector<HTMLInputElement>('input[name="turnstileToken"]');
  expect(hidden()).not.toBeNull();
  expect(hidden()!.value).toBe("");
  expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(true);

  getCallback()?.("fresh-token");

  await waitFor(() => expect(hidden()!.value).toBe("fresh-token"));
  expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
});

test("keeps sign-in usable when no challenge is configured", () => {
  const { container } = render(<LoginForm />);

  expect(container.querySelector('input[name="turnstileToken"]')).toBeNull();
  expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
});
