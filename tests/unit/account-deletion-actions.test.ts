import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), getCurrentProfile: vi.fn(), redirect: vi.fn(), rpc: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.getCurrentProfile }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ rpc: mocks.rpc })) }));

import { deleteMyAccount } from "@/app/(ritual)/settings/account/actions";

describe("account deletion action", () => {
  beforeEach(() => {
    mocks.getCurrentProfile.mockReset().mockResolvedValue({ isDemo: false, userId: ownerId });
    mocks.rpc.mockReset();
    mocks.cookies.mockReset().mockResolvedValue({ delete: vi.fn(), getAll: () => [{ name: "sb-local-auth-token" }, { name: "unrelated" }] });
    mocks.redirect.mockReset();
  });
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const form = (confirmation: string) => {
    const data = new FormData();
    data.set("confirmation", confirmation);
    return data;
  };

  test("requires deliberate confirmation before any auth or RPC call", async () => {
    await expect(deleteMyAccount({ message: "", status: "idle" }, form("delete"))).resolves.toEqual({ message: "Type DELETE exactly to confirm account deletion.", status: "error" });
    expect(mocks.getCurrentProfile).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("refuses demo accounts before the deletion RPC", async () => {
    mocks.getCurrentProfile.mockResolvedValueOnce({ isDemo: true, userId: ownerId });
    await expect(deleteMyAccount({ message: "", status: "idle" }, form("DELETE"))).resolves.toEqual({ message: "Demo accounts cannot be deleted from settings.", status: "error" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  test("calls only the zero-argument self-deletion RPC and clears session cookies", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: null });
    mocks.redirect.mockImplementationOnce(() => { throw new Error("redirect"); });
    await expect(deleteMyAccount({ message: "", status: "idle" }, form("DELETE"))).rejects.toThrow("redirect");
    expect(mocks.rpc).toHaveBeenCalledWith("delete_my_account");
    expect((await mocks.cookies()).delete).toHaveBeenCalledWith("sb-local-auth-token");
    expect((await mocks.cookies()).delete).not.toHaveBeenCalledWith("unrelated");
    expect(mocks.redirect).toHaveBeenCalledWith("/login?deleted=1");
  });
});
