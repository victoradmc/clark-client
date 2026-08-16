import { describe, expect, it } from "vitest";
import { en } from "./locales/en";
import { ptBR } from "./locales/pt-BR";

// Recursively flattens a nested translation object into dot-paths (e.g.
// "hub.tabPublic") so two locale trees can be compared key-for-key,
// independent of value content — this is what catches a silently-missing
// translation in either direction.
function flattenKeys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return flattenKeys(value, path);
    }
    return [path];
  });
}

describe("translation resources", () => {
  it("have exactly the same set of keys in English and Brazilian Portuguese", () => {
    const enKeys = flattenKeys(en).sort();
    const ptBRKeys = flattenKeys(ptBR).sort();

    const missingFromPtBR = enKeys.filter((k) => !ptBRKeys.includes(k));
    const missingFromEn = ptBRKeys.filter((k) => !enKeys.includes(k));

    expect(missingFromPtBR, "keys present in en but missing from pt-BR").toEqual([]);
    expect(missingFromEn, "keys present in pt-BR but missing from en").toEqual([]);
    expect(ptBRKeys).toEqual(enKeys);
  });
});
