import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import HomePage from "@/app/(marketing)/page";

test("explains the human commit boundary", () => {
  render(<HomePage />);

  expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/quiet ledger/i);
  expect(screen.getByText(/only you can commit it/i)).toBeDefined();
});
