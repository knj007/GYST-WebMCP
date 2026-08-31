export const blockerTypes = ["internal", "external_gate", "capacity", "clarity", "dependency", "other"] as const;
export const commitmentOutcomes = ["done", "partial", "deferred", "not_done", "planned_skip"] as const;
export const weeklyArrows = ["up", "steady", "down"] as const;

export const uuidPattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

export function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Tool input must be an object.");
  return value as Record<string, unknown>;
}

export function optionalText(value: unknown, maximum: number, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maximum) throw new Error(`${field} must be text no longer than ${maximum} characters.`);
  return value.trim() || null;
}

export function requiredText(value: unknown, maximum: number, field: string): string {
  const text = optionalText(value, maximum, field);
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

export function enumValue<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`${field} is invalid.`);
  return value as T;
}

export function requiredUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !(new RegExp(uuidPattern, "i")).test(value)) throw new Error(`${field} must be a UUID.`);
  return value;
}
