import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

// `next/script` calls `onLoad` from the script's `load` event. The real module
// fires it at most once per full page load, so this stand-in exposes it as an
// explicit control rather than firing it on render.
const scriptLoads: Array<() => void> = [];
vi.mock("next/script", () => ({
  default: ({ onLoad }: { onLoad: () => void }) => {
    scriptLoads.push(onLoad);
    return <div data-testid="turnstile-script" />;
  },
}));

import { TurnstileChallenge, type TurnstileChallengeHandle } from "@/components/turnstile-challenge";

afterEach(() => {
  cleanup();
  scriptLoads.length = 0;
  delete window.turnstile;
  vi.restoreAllMocks();
});

function stubTurnstile() {
  const remove = vi.fn();
  const reset = vi.fn();
  const rendered: Array<{ container: HTMLElement; sitekey: string }> = [];
  let callbacks: { callback: (token: string) => void; "error-callback": () => void; "expired-callback": () => void } | undefined;
  let nextId = 0;

  window.turnstile = {
    remove,
    render: (container, options) => {
      callbacks = options;
      rendered.push({ container, sitekey: options.sitekey });
      nextId += 1;
      return `widget-${nextId}`;
    },
    reset,
  };

  return { getCallbacks: () => callbacks, remove, rendered, reset };
}

const noop = () => {};

test("renders the widget on mount when the Turnstile script has already loaded", () => {
  // The state a client-side navigation arrives in: the source loaded on an
  // earlier page, so `window.turnstile` exists and no `load` event is coming.
  const stub = stubTurnstile();

  render(<TurnstileChallenge onError={noop} onExpire={noop} onToken={noop} siteKey="public-site-key" />);

  expect(stub.rendered).toHaveLength(1);
  expect(stub.rendered[0]!.sitekey).toBe("public-site-key");
  expect(stub.rendered[0]!.container.getAttribute("aria-label")).toBe("Verification challenge");
});

test("renders the widget once when the script load event arrives after mount", () => {
  // The state a full page load arrives in: nothing to render against on mount,
  // so the widget waits for `onLoad` -- and the mount attempt must not double it.
  render(<TurnstileChallenge onError={noop} onExpire={noop} onToken={noop} siteKey="public-site-key" />);
  const stub = stubTurnstile();

  expect(stub.rendered).toHaveLength(0);
  for (const load of scriptLoads) {
    load();
  }

  expect(stub.rendered).toHaveLength(1);
});

test("renders once the in-flight script element finishes loading", () => {
  // The third arrival: `next/script` records the source as loaded the moment the
  // request starts, so a component mounted during a later hop while the source is
  // still in flight gets no `onLoad` of its own and finds no API to render against.
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  document.body.append(script);

  try {
    render(<TurnstileChallenge onError={noop} onExpire={noop} onToken={noop} siteKey="public-site-key" />);
    const stub = stubTurnstile();
    expect(stub.rendered).toHaveLength(0);

    script.dispatchEvent(new Event("load"));

    expect(stub.rendered).toHaveLength(1);
  } finally {
    script.remove();
  }
});

test("reports a rejected site key instead of throwing out of the mount effect", () => {
  const stub = stubTurnstile();
  window.turnstile!.render = () => {
    throw new Error("invalid sitekey");
  };
  const onError = vi.fn();

  // Turnstile throws on a key it rejects. From a mount effect an uncaught throw
  // would take down the tree, so it has to surface as an ordinary failure.
  expect(() =>
    render(<TurnstileChallenge onError={onError} onExpire={noop} onToken={noop} siteKey="rejected-site-key" />),
  ).not.toThrow();
  expect(onError).toHaveBeenCalledTimes(1);
  expect(stub.rendered).toHaveLength(0);
});

test("reports the solved token, expiry, and failure to its owner", async () => {
  const stub = stubTurnstile();
  const onError = vi.fn();
  const onExpire = vi.fn();
  const onToken = vi.fn();

  render(<TurnstileChallenge onError={onError} onExpire={onExpire} onToken={onToken} siteKey="public-site-key" />);
  stub.getCallbacks()!.callback("fresh-token");
  stub.getCallbacks()!["expired-callback"]();
  stub.getCallbacks()!["error-callback"]();

  await waitFor(() => expect(onToken).toHaveBeenCalledWith("fresh-token"));
  expect(onExpire).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledTimes(1);
});

test("keeps a solved challenge across an owner re-render with fresh handlers", () => {
  const stub = stubTurnstile();
  const { rerender } = render(
    <TurnstileChallenge onError={noop} onExpire={noop} onToken={noop} siteKey="public-site-key" />,
  );

  rerender(<TurnstileChallenge onError={() => {}} onExpire={() => {}} onToken={() => {}} siteKey="public-site-key" />);

  expect(stub.rendered).toHaveLength(1);
  expect(stub.remove).not.toHaveBeenCalled();
});

test("resets its widget on request and removes it on unmount", () => {
  const stub = stubTurnstile();
  const handle = { current: null as TurnstileChallengeHandle | null };
  const { unmount } = render(
    <TurnstileChallenge onError={noop} onExpire={noop} onToken={noop} ref={handle} siteKey="public-site-key" />,
  );

  handle.current!.reset();
  expect(stub.reset).toHaveBeenCalledWith("widget-1");

  unmount();
  expect(stub.remove).toHaveBeenCalledWith("widget-1");
});

test("leaves its container empty until the Turnstile source is available", () => {
  render(<TurnstileChallenge onError={noop} onExpire={noop} onToken={noop} siteKey="public-site-key" />);

  expect(screen.getByLabelText("Verification challenge").childElementCount).toBe(0);
});
