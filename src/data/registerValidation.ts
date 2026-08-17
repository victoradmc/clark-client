export type ParsedRegisterFields = {
  name: string;
  email: string;
  password: string;
};

// Minimum-length only, no complexity rules (spec's password-policy
// decision). Exported so LoginScreen's pre-submit check and
// validateRegisterFields below enforce the same number — the Admin
// Accounts tab's account-creation form and the admin-accounts Edge
// Function are meant to reuse this too (spec's "one rule set" decision),
// but that wiring is ticket 02's job, not this one.
export const MIN_PASSWORD_LENGTH = 8;

// Re-validated at the clarkApi.register seam as defense in depth, on top
// of LoginScreen's own pre-submit check — same two-layer convention as
// lessonValidation.ts.
export function validateRegisterFields(input: unknown): ParsedRegisterFields {
  if (typeof input !== "object" || input === null) {
    throw new Error("Expected name, email, and password.");
  }

  const { name, email, password } = input as Record<string, unknown>;

  const missing: string[] = [];
  if (typeof name !== "string" || !name.trim()) missing.push("name");
  if (typeof email !== "string" || !email.trim()) missing.push("email");
  if (typeof password !== "string" || !password) missing.push("password");
  if (missing.length > 0) {
    throw new Error(
      `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    );
  }

  if ((password as string).length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  return {
    name: (name as string).trim(),
    email: (email as string).trim(),
    password: password as string,
  };
}
