export const displayValue = value => Array.isArray(value) ? value.join("\n") : value && typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "");

export function parseFieldValue(value, definition, saved) {
  if (["object", "catalog-flags", "card-list", "deck-composition", "offer-prices", "offer-sale", "pack-composition"].includes(definition.type)) return JSON.parse(value);
  if (definition.type === "integer") {
    if (value === "" || !Number.isSafeInteger(Number(value))) throw new Error(`${definition.label} needs a whole number.`);
    return Number(value);
  }
  if (["lines", "assets"].includes(definition.type)) return value === "" ? (Array.isArray(saved) && saved.length === 1 && saved[0] === null ? [null] : []) : value.split("\n").map((line, index) => definition.type === "assets" && line === "" && saved?.[index] === null ? null : line);
  return value;
}

export function bufferTarget(key) {
  const parts = key.split(":");
  return parts.length >= 3 ? { domain: parts.shift(), field: parts.pop(), id: parts.join(":") } : null;
}
