import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WebMcpTools } from "@/components/webmcp-tools";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const registrations: Array<{ signal: AbortSignal; tool: { annotations?: { readOnlyHint?: boolean }; execute: (input: unknown) => Promise<unknown>; name: string } }> = [];

afterEach(() => {
  registrations.length = 0;
  refresh.mockReset();
  delete document.modelContext;
});

describe("WebMCP ritual lifecycle", () => {
  test("registers only daily tools and aborts them on route unmount", async () => {
    document.modelContext = { registerTool: vi.fn(async (tool, { signal }) => { registrations.push({ signal, tool }); }) };
    const view = render(<WebMcpTools ritual="daily" />);
    await waitFor(() => expect(registrations).toHaveLength(7));
    expect(registrations.map(({ tool }) => tool.name)).toEqual(expect.arrayContaining(["gyst.get_daily_context", "gyst.review_daily_draft"]));
    expect(registrations.filter(({ tool }) => tool.name.startsWith("gyst.get_") || tool.name.startsWith("gyst.review_")).every(({ tool }) => tool.annotations?.readOnlyHint)).toBe(true);
    view.unmount();
    expect(registrations.every(({ signal }) => signal.aborted)).toBe(true);
  });

  test("registers only weekly tools", async () => {
    document.modelContext = { registerTool: vi.fn(async (tool, { signal }) => { registrations.push({ signal, tool }); }) };
    render(<WebMcpTools ritual="weekly" />);
    await waitFor(() => expect(registrations).toHaveLength(7));
    expect(registrations.map(({ tool }) => tool.name)).toEqual(expect.arrayContaining(["gyst.get_weekly_context", "gyst.review_weekly_draft"]));
    expect(registrations.some(({ tool }) => tool.name.includes("daily"))).toBe(false);
  });

  test("refreshes the ritual after a successful agent draft edit", async () => {
    document.modelContext = { registerTool: vi.fn(async (tool, { signal }) => { registrations.push({ signal, tool }); }) };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Draft updated." }), { status: 200 }));
    render(<WebMcpTools ritual="daily" />);
    await waitFor(() => expect(registrations).toHaveLength(7));
    const tool = registrations.find(({ tool }) => tool.name === "gyst.record_moved")?.tool;
    expect(tool).toBeDefined();
    await tool!.execute({ text: "Prepared release notes" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    fetchMock.mockRestore();
  });
});
