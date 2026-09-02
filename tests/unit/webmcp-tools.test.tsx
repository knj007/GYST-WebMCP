import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WebMcpTools } from "@/components/webmcp-tools";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const registrations: Array<{ signal: AbortSignal; tool: { annotations?: { readOnlyHint?: boolean }; execute: (input: unknown) => Promise<unknown>; name: string } }> = [];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  registrations.length = 0;
  refresh.mockReset();
  delete document.modelContext;
});

describe("WebMCP ritual lifecycle", () => {
  test("registers only daily tools and aborts them on route unmount", async () => {
    document.modelContext = { registerTool: vi.fn(async (tool, { signal }) => { registrations.push({ signal, tool }); }) };
    const view = render(<WebMcpTools periodStart="2026-09-01" ritual="daily" />);
    await waitFor(() => expect(registrations).toHaveLength(7));
    expect(await screen.findByText("Agent assistance is ready: all 7 draft-only tools are available in this tab.")).toBeTruthy();
    expect(registrations.map(({ tool }) => tool.name)).toEqual(expect.arrayContaining(["gyst.get_daily_context", "gyst.review_daily_draft"]));
    expect(registrations.filter(({ tool }) => tool.name.startsWith("gyst.get_") || tool.name.startsWith("gyst.review_")).every(({ tool }) => tool.annotations?.readOnlyHint)).toBe(true);
    view.unmount();
    expect(registrations.every(({ signal }) => signal.aborted)).toBe(true);
  });

  test("registers only weekly tools", async () => {
    document.modelContext = { registerTool: vi.fn(async (tool, { signal }) => { registrations.push({ signal, tool }); }) };
    render(<WebMcpTools periodStart="2026-09-01" ritual="weekly" />);
    await waitFor(() => expect(registrations).toHaveLength(7));
    expect(registrations.map(({ tool }) => tool.name)).toEqual(expect.arrayContaining(["gyst.get_weekly_context", "gyst.review_weekly_draft"]));
    expect(registrations.some(({ tool }) => tool.name.includes("daily"))).toBe(false);
  });

  test("refreshes the ritual after a successful agent draft edit", async () => {
    document.modelContext = { registerTool: vi.fn(async (tool, { signal }) => { registrations.push({ signal, tool }); }) };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ effect: "Updated moved_text.", message: "Draft updated.", uncommitted: true, updated_fields: ["moved_text"] }), { status: 200 }));
    render(<WebMcpTools periodStart="2026-09-01" ritual="daily" />);
    await waitFor(() => expect(registrations).toHaveLength(7));
    const tool = registrations.find(({ tool }) => tool.name === "gyst.record_moved")?.tool;
    expect(tool).toBeDefined();
    await expect(tool!.execute({ text: "Prepared release notes" })).resolves.toMatchObject({ uncommitted: true, updated_fields: ["moved_text"] });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByText(/record moved updated moved text; it was not committed/i)).toBeTruthy();
    fetchMock.mockRestore();
  });

  test("explains when the browser does not expose WebMCP", async () => {
    vi.useFakeTimers();
    render(<WebMcpTools periodStart="2026-09-01" ritual="daily" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByText(/Agent assistance is unavailable in this browser/i)).toBeTruthy();
  });

  test("waits for a late WebMCP host before declaring it unavailable", async () => {
    vi.useFakeTimers();
    document.modelContext = undefined;
    render(<WebMcpTools periodStart="2026-09-01" ritual="daily" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(registrations).toHaveLength(0);
    document.modelContext = { registerTool: vi.fn(async (tool, { signal }) => { registrations.push({ signal, tool }); }) };
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(registrations).toHaveLength(7);
    expect(screen.getByText("Agent assistance is ready: all 7 draft-only tools are available in this tab.")).toBeTruthy();
  });

  test("stops waiting when the ritual route unmounts", async () => {
    vi.useFakeTimers();
    const view = render(<WebMcpTools periodStart="2026-09-01" ritual="daily" />);
    view.unmount();
    document.modelContext = { registerTool: vi.fn(async (tool, { signal }) => { registrations.push({ signal, tool }); }) };
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(registrations).toHaveLength(0);
  });
});
