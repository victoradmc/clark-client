import { afterEach, describe, expect, it } from "vitest";
import { EmailAlreadyRegisteredError, getSession, logout, register } from "../clarkApi";
import { findEmailTo, serviceRoleClient } from "./support";

afterEach(async () => {
  await logout();
});

async function deleteAccountByEmail(email: string) {
  const { data } = await serviceRoleClient.auth.admin.listUsers();
  const existing = data.users.find((u) => u.email === email);
  if (existing) await serviceRoleClient.auth.admin.deleteUser(existing.id);
}

describe("clarkApi.register", () => {
  it("creates a Student Account and signs the caller in immediately", async () => {
    const email = "register-new@clark.test";
    try {
      await register({ name: "New Learner", email, password: "correct-horse" });

      const session = await getSession();
      expect(session?.user.email).toBe(email);

      const { data: profileRow } = await serviceRoleClient
        .from("profiles")
        .select("name, email, role, locale")
        .eq("id", session!.user.id)
        .single();
      expect(profileRow).toMatchObject({
        name: "New Learner",
        email,
        role: "student",
        // Not set explicitly by register() or the on_auth_user_created
        // trigger — this is the profiles.locale column's default.
        locale: "pt-BR",
      });
    } finally {
      await deleteAccountByEmail(email);
    }
  });

  it("forces the Student Role even if a role-shaped value is smuggled in", async () => {
    const email = "register-role-smuggle@clark.test";
    try {
      await register({
        name: "Sneaky",
        email,
        password: "correct-horse",
        // @ts-expect-error — register() accepts no role field; this proves
        // the trigger, not just the type signature, is what enforces it.
        role: "admin",
      });

      const session = await getSession();
      const { data: profileRow } = await serviceRoleClient
        .from("profiles")
        .select("role")
        .eq("id", session!.user.id)
        .single();
      expect(profileRow?.role).toBe("student");
    } finally {
      await deleteAccountByEmail(email);
    }
  });

  it("sends no email as part of registration", async () => {
    const email = "register-no-email@clark.test";
    try {
      await register({ name: "Quiet Signup", email, password: "correct-horse" });
      const message = await findEmailTo(email, { timeoutMs: 1000 });
      expect(message).toBeNull();
    } finally {
      await deleteAccountByEmail(email);
    }
  });

  it("rejects a duplicate email with EmailAlreadyRegisteredError", async () => {
    const email = "register-duplicate@clark.test";
    try {
      await register({ name: "First", email, password: "correct-horse" });
      await logout();
      await expect(
        register({ name: "Second", email, password: "another-password" }),
      ).rejects.toThrow(EmailAlreadyRegisteredError);
    } finally {
      await deleteAccountByEmail(email);
    }
  });

  it("rejects a password shorter than the minimum length before any network call", async () => {
    await expect(
      register({ name: "Short", email: "register-short-pw@clark.test", password: "short" }),
    ).rejects.toThrow(/8 characters/);
    // No Account should have been created — the call never reached Supabase.
    expect(await getSession()).toBeNull();
  });
});
