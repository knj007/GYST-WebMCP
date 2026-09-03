"use client";

import { useState } from "react";

type CopyableTextProps = {
  id: string;
  label: string;
  rows?: number;
  text: string;
};

/**
 * A read-only block the owner can copy in one click. The clipboard API is
 * optional; when it is unavailable the text is selected so a manual copy is
 * one keystroke away.
 */
export function CopyableText({ id, label, rows = 8, text }: CopyableTextProps) {
  const [status, setStatus] = useState<"copied" | "idle" | "select">("idle");

  async function copy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        setStatus("copied");
        return;
      }
    } catch {
      // Fall through to manual selection.
    }
    const field = document.getElementById(id);
    if (field instanceof HTMLTextAreaElement) {
      field.focus();
      field.select();
    }
    setStatus("select");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm font-semibold" htmlFor={id}>{label}</label>
        <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold" onClick={copy} type="button">
          Copy
        </button>
      </div>
      <textarea className="mt-2 w-full rounded-xl border border-line bg-background p-3 font-mono text-xs leading-5" id={id} readOnly rows={rows} value={text} />
      {status !== "idle" ? (
        <p aria-live="polite" className="mt-2 text-sm text-muted">
          {status === "copied" ? "Copied to your clipboard." : "Clipboard access is unavailable here; the text is selected, so copy it with your keyboard."}
        </p>
      ) : null}
    </div>
  );
}
