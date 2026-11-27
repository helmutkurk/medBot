import type { PatientCase } from "./types.ts";

const categories = new Set(["complaint", "symptom", "history", "medication", "allergy", "family", "social", "lifestyle"]);
const voices = new Set(["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCase(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["Case must be an object."];
  function string(obj: Record<string, unknown>, key: string, path: string): void {
    if (typeof obj[key] !== "string" || !obj[key].trim()) errors.push(`${path}.${key} must be a non-empty string.`);
  }
  for (const key of ["id", "title", "note", "background", "unknown_answer"]) string(value, key, "case");
  if (typeof value.id === "string" && !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(value.id)) errors.push("case.id must be a safe lowercase identifier.");
  if (!isRecord(value.patient)) errors.push("case.patient must be an object.");
  else {
    for (const key of ["name", "job", "lives_with"]) string(value.patient, key, "case.patient");
    if (!Number.isInteger(value.patient.age) || Number(value.patient.age) < 0 || Number(value.patient.age) > 130) errors.push("case.patient.age must be an integer from 0 to 130.");
    if (!["male", "female", "other"].includes(String(value.patient.sex))) errors.push("case.patient.sex must be male, female or other.");
  }
  if (!Array.isArray(value.never_say) || value.never_say.length === 0 || value.never_say.some(v => typeof v !== "string" || !v.trim())) errors.push("case.never_say must contain non-empty strings.");
  for (const collection of ["facts", "personalities"] as const) {
    const items = value[collection];
    if (!Array.isArray(items) || items.length === 0) {
      errors.push(`case.${collection} must be a non-empty array.`);
      continue;
    }
    const ids = new Set<string>();
    items.forEach((item: unknown, index: number) => {
      const path = `case.${collection}[${index}]`;
      if (!isRecord(item)) { errors.push(`${path} must be an object.`); return; }
      const fields = collection === "facts" ? ["id", "category", "truth", "lay", "reveal_when"] : ["id", "label", "style", "emotion", "voice", "opening_line"];
      for (const key of fields) string(item, key, path);
      if (typeof item.id === "string") {
        if (ids.has(item.id)) errors.push(`${path}.id is duplicated: ${item.id}.`);
        ids.add(item.id);
        if (!(collection === "facts" ? /^[a-z][a-z0-9_]*$/ : /^[a-z][a-z0-9_-]*$/).test(item.id)) errors.push(`${path}.id has an invalid identifier format.`);
      }
      if (collection === "facts" && !categories.has(String(item.category))) errors.push(`${path}.category is not supported.`);
      if (collection === "personalities") {
        if (!voices.has(String(item.voice))) errors.push(`${path}.voice is not supported.`);
        if (!Array.isArray(item.example_lines) || item.example_lines.length === 0 || item.example_lines.some(v => typeof v !== "string" || !v.trim())) errors.push(`${path}.example_lines must contain non-empty strings.`);
      }
    });
  }
  return errors;
}

export function assertCase(value: unknown): asserts value is PatientCase {
  const errors = validateCase(value);
  if (errors.length) throw new Error(`Invalid patient case:\n${errors.join("\n")}`);
}
