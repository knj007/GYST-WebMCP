"use client";

import Script from "next/script";
import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react";

type TurnstileApi = {
  remove: (widgetId: string) => void;
  render: (container: HTMLElement, options: {
    callback: (token: string) => void;
    "error-callback": () => void;
    "expired-callback": () => void;
    sitekey: string;
  }) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileChallengeHandle = {
  /** Discard the solved token and ask Cloudflare for a fresh challenge. */
  reset: () => void;
};

type TurnstileChallengeProps = {
  onError: () => void;
  onExpire: () => void;
  onToken: (token: string) => void;
  ref?: Ref<TurnstileChallengeHandle>;
  siteKey: string;
};

// One shared id so every challenge on the site resolves to the same `next/script`
// cache entry, instead of colliding implicitly on the source URL.
const scriptId = "cloudflare-turnstile";
const scriptSrc = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * The explicit Cloudflare Turnstile widget, mounted so it survives navigation.
 *
 * `next/script` calls `onLoad` from the script's `load` event, and it loads the
 * source at most once per full page load. A form reached by a client-side
 * navigation therefore mounts with `window.turnstile` already defined and no
 * further `load` event coming, so waiting on `onLoad` alone leaves the widget
 * unrendered and the submit control disabled until the visitor refreshes.
 * This renders on mount as well, and covers the third arrival -- mounting while
 * the source is still in flight -- by listening to the script element itself.
 */
export function TurnstileChallenge({ onError, onExpire, onToken, ref, siteKey }: TurnstileChallengeProps) {
  const widgetContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const mounted = useRef(false);

  // Callbacks are read through a ref so that a parent re-render never re-renders
  // the widget, which would throw away a challenge the visitor already solved.
  const callbacks = useRef({ onError, onExpire, onToken });
  useEffect(() => {
    callbacks.current = { onError, onExpire, onToken };
  });

  const renderWidget = useCallback(() => {
    if (!mounted.current || !widgetContainer.current || widgetId.current || !window.turnstile) {
      return;
    }

    try {
      widgetId.current = window.turnstile.render(widgetContainer.current, {
        callback: (token) => callbacks.current.onToken(token),
        "error-callback": () => callbacks.current.onError(),
        "expired-callback": () => callbacks.current.onExpire(),
        sitekey: siteKey,
      });
    } catch {
      // Turnstile throws on a site key it rejects. That used to surface from the
      // script's own load handler, outside React; raising it from a mount effect
      // would take down the tree instead, so report it the way Turnstile reports
      // its own failures and leave the submit control locked.
      widgetId.current = undefined;
      callbacks.current.onError();
    }
  }, [siteKey]);

  useEffect(() => {
    mounted.current = true;
    renderWidget();

    // `next/script` records the source as loaded as soon as the request starts,
    // so a component mounted during a later client-side hop while the source is
    // still in flight is skipped outright: no `load` event of its own, and no API
    // to render against yet. Listening to the pending element resolves that
    // arrival too, instead of stranding the challenge until a refresh.
    const pending = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);
    pending?.addEventListener("load", renderWidget);

    return () => {
      pending?.removeEventListener("load", renderWidget);
      mounted.current = false;
      if (widgetId.current) {
        try {
          window.turnstile?.remove(widgetId.current);
        } catch {
          // A widget Cloudflare has already discarded is not worth a crash on the
          // way out; the container leaves with the component regardless.
        }
        widgetId.current = undefined;
      }
    };
  }, [renderWidget]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId.current) {
        window.turnstile?.reset(widgetId.current);
      }
    },
  }), []);

  return (
    <>
      <Script id={scriptId} onLoad={renderWidget} src={scriptSrc} strategy="afterInteractive" />
      <div aria-label="Verification challenge" ref={widgetContainer} />
    </>
  );
}
