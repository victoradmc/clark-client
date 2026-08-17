import { afterEach, describe, expect, it, vi } from "vitest";
import { friendlyErrorMessage } from "./errorMessage";

describe("friendlyErrorMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the given fallback for a real Error instance", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(friendlyErrorMessage(new Error("Missing required field: title."), "Could not save.")).toBe(
      "Could not save.",
    );
  });

  it("returns the given fallback for a PostgREST-shaped plain object (not an Error instance)", () => {
    // supabase-js's default (non-throwOnError) query mode throws the raw
    // parsed PostgREST error body — a plain object, not an `Error` — so this
    // is the shape that broke the old `err instanceof Error` checks.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const postgrestError = {
      message: "duplicate key value violates unique constraint",
      code: "23505",
      details: null,
      hint: null,
    };
    expect(friendlyErrorMessage(postgrestError, "Could not load accounts.")).toBe(
      "Could not load accounts.",
    );
  });

  it("returns the given fallback for a thrown string, null, or undefined", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(friendlyErrorMessage("boom", "Fallback.")).toBe("Fallback.");
    expect(friendlyErrorMessage(null, "Fallback.")).toBe("Fallback.");
    expect(friendlyErrorMessage(undefined, "Fallback.")).toBe("Fallback.");
  });

  it("logs the original error unmodified for debugging", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = new Error("raw database detail");
    friendlyErrorMessage(original, "Could not save.");
    expect(consoleError).toHaveBeenCalledWith(original);
  });

  it("never surfaces the original error's own message as its return value", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = friendlyErrorMessage(
      new Error("raw, technical, untranslated detail"),
      "Something went wrong.",
    );
    expect(result).not.toContain("raw, technical, untranslated detail");
  });
});
