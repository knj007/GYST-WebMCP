"use client";

import { useEffect, useState } from "react";

type Listener = () => void;

const fieldsByRitual = new Map<string, Set<string>>();
const listeners = new Map<string, Set<Listener>>();

function storageKey(ritualKey: string) {
  return `gyst:webmcp-agent-fields:${ritualKey}`;
}

function fieldsFor(ritualKey: string) {
  const existing = fieldsByRitual.get(ritualKey);
  if (existing) return existing;

  let restored = new Set<string>();
  if (typeof window !== "undefined") {
    try {
      const saved = window.sessionStorage.getItem(storageKey(ritualKey));
      const values: unknown = saved ? JSON.parse(saved) : [];
      if (Array.isArray(values)) restored = new Set(values.filter((value): value is string => typeof value === "string"));
    } catch {
      // Provenance is an assistive UI affordance; a blocked storage area must not block the ritual.
    }
  }
  fieldsByRitual.set(ritualKey, restored);
  return restored;
}

function notify(ritualKey: string) {
  listeners.get(ritualKey)?.forEach((listener) => listener());
}

function persist(ritualKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(ritualKey), JSON.stringify([...fieldsFor(ritualKey)]));
  } catch {
    // The current in-memory state remains useful when storage is unavailable.
  }
}

export function markAgentDraftFields(ritualKey: string, fields: readonly string[]) {
  const current = fieldsFor(ritualKey);
  let changed = false;
  for (const field of fields) {
    if (!current.has(field)) {
      current.add(field);
      changed = true;
    }
  }
  if (changed) {
    persist(ritualKey);
    notify(ritualKey);
  }
}

export function clearHumanDraftField(ritualKey: string, field: string) {
  const current = fieldsFor(ritualKey);
  if (!current.delete(field)) return;
  persist(ritualKey);
  notify(ritualKey);
}

export function useAgentDraftFields(ritualKey: string) {
  const [fields, setFields] = useState(() => new Set(fieldsFor(ritualKey)));

  useEffect(() => {
    const listener = () => setFields(new Set(fieldsFor(ritualKey)));
    const subscribers = listeners.get(ritualKey) ?? new Set<Listener>();
    subscribers.add(listener);
    listeners.set(ritualKey, subscribers);
    return () => {
      subscribers.delete(listener);
      if (subscribers.size === 0) listeners.delete(ritualKey);
    };
  }, [ritualKey]);

  return {
    agentUpdated: (field: string) => fields.has(field),
    clearHumanEdit: (field: string) => clearHumanDraftField(ritualKey, field),
    fields,
  };
}
