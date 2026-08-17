import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createAccount,
  deleteAccount,
  getAccounts,
  getSession,
  login,
  logout,
  requestPasswordReset,
  updateAccountRole,
} from "../clarkApi";
import { supabase } from "../supabaseClient";
import {
  ensureFixtureAccount,
  findEmailTo,
  FIXTURE_PASSWORD,
  serviceRoleClient,
} from "./support";

const ADMIN_EMAIL = "accounts-admin@clark.test";
const STUDENT_EMAIL = "accounts-student@clark.test";
const ACTIVE_EMAIL = "accounts-active@clark.test";
// Used only for the "invited" status assertion below — every other fixture
// Account in this file gets logged into by some other test case, which
// permanently flips its status to "active" (last_sign_in_at never resets),
// so reruns against the persistent local DB need one Account nothing else
// ever signs in as.
const NEVER_SIGNED_IN_EMAIL = "accounts-never-signed-in@clark.test";

let adminId: string;
let studentId: string;
let activeId: string;
let neverSignedInId: string;

beforeAll(async () => {
  adminId = await ensureFixtureAccount(ADMIN_EMAIL, "admin", "Accounts Admin");
  studentId = await ensureFixtureAccount(STUDENT_EMAIL, "student", "Accounts Student");
  activeId = await ensureFixtureAccount(ACTIVE_EMAIL, "student", "Accounts Active");
  neverSignedInId = await ensureFixtureAccount(
    NEVER_SIGNED_IN_EMAIL,
    "student",
    "Never Signed In",
  );
  // Give one fixture Account a real sign-in so its status is "active" (the
  // others were only ever created via the Admin API, i.e. still "invited").
  await login(ACTIVE_EMAIL, FIXTURE_PASSWORD);
  await logout();
});

afterEach(async () => {
  await logout();
});

describe("clarkApi.getAccounts", () => {
  it("lists every Account for an Admin, with status computed from sign-in history", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const accounts = await getAccounts();

    const neverSignedIn = accounts.find((a) => a.id === neverSignedInId);
    expect(neverSignedIn).toMatchObject({
      name: "Never Signed In",
      email: NEVER_SIGNED_IN_EMAIL,
      role: "student",
      status: "invited",
    });

    const active = accounts.find((a) => a.id === activeId);
    expect(active?.status).toBe("active");
  });

  it("is rejected for a Student", async () => {
    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    await expect(getAccounts()).rejects.toThrow();
  });
});

describe("clarkApi.updateAccountRole", () => {
  it("lets an Admin change another Account's Role", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    await updateAccountRole(studentId, "admin");

    const { data } = await serviceRoleClient
      .from("profiles")
      .select("role")
      .eq("id", studentId)
      .single();
    expect(data?.role).toBe("admin");

    // restore fixture state for reruns against the persistent local DB
    await serviceRoleClient.from("profiles").update({ role: "student" }).eq("id", studentId);
  });
});

describe("clarkApi.createAccount", () => {
  const CREATED_EMAIL = "accounts-created@clark.test";
  const CREATED_PASSWORD = "correct-horse-battery";

  afterEach(async () => {
    const { data: list } = await serviceRoleClient.auth.admin.listUsers();
    const existing = list.users.find((u) => u.email === CREATED_EMAIL);
    if (existing) await serviceRoleClient.auth.admin.deleteUser(existing.id);
  });

  it("creates a Student Account usable immediately with no email sent", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const account = await createAccount({
      name: "New Student",
      email: CREATED_EMAIL,
      password: CREATED_PASSWORD,
      role: "student",
    });

    expect(account.email).toBe(CREATED_EMAIL);
    expect(account.role).toBe("student");
    expect(account.status).toBe("invited");

    const { data: profileRow } = await serviceRoleClient
      .from("profiles")
      .select("name, email, role, locale")
      .eq("id", account.id)
      .single();
    expect(profileRow).toEqual({
      name: "New Student",
      email: CREATED_EMAIL,
      role: "student",
      // Not set explicitly by createAccount() or the Edge Function's
      // upsert — this is the profiles.locale column's default.
      locale: "pt-BR",
    });

    expect(await findEmailTo(CREATED_EMAIL, { timeoutMs: 1000 })).toBeNull();

    await logout();
    await login(CREATED_EMAIL, CREATED_PASSWORD);
    const session = await getSession();
    expect(session?.user.email).toBe(CREATED_EMAIL);
  });

  it("creates an Admin Account the same way", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const account = await createAccount({
      name: "New Admin",
      email: CREATED_EMAIL,
      password: CREATED_PASSWORD,
      role: "admin",
    });
    expect(account.role).toBe("admin");

    const { data: profileRow } = await serviceRoleClient
      .from("profiles")
      .select("role")
      .eq("id", account.id)
      .single();
    expect(profileRow?.role).toBe("admin");
  });

  it("rejects a password shorter than the minimum length client-side, before any network call", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    await expect(
      createAccount({ name: "X", email: CREATED_EMAIL, password: "short", role: "student" }),
    ).rejects.toThrow(/8 characters/);

    const { data: list } = await serviceRoleClient.auth.admin.listUsers();
    expect(list.users.some((u) => u.email === CREATED_EMAIL)).toBe(false);
  });

  // createAccount() validates client-side before ever reaching the Edge
  // Function, so the test above never actually exercises the Function's own
  // (hand-duplicated, since Deno can't import registerValidation.ts) length
  // check. Bypasses clarkApi entirely — same call shape
  // invokeAdminAccountsFunction uses — to verify that check independently.
  it("rejects a password shorter than the minimum length at the Edge Function itself", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const { error } = await supabase.functions.invoke("admin-accounts", {
      body: { action: "create", name: "X", email: CREATED_EMAIL, password: "short", role: "student" },
    });
    expect(error).not.toBeNull();

    const { data: list } = await serviceRoleClient.auth.admin.listUsers();
    expect(list.users.some((u) => u.email === CREATED_EMAIL)).toBe(false);
  });

  it("is rejected for a Student", async () => {
    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    await expect(
      createAccount({
        name: "X",
        email: CREATED_EMAIL,
        password: CREATED_PASSWORD,
        role: "student",
      }),
    ).rejects.toThrow();
  });
});

// The Edge Function can't import registerValidation.ts's MIN_PASSWORD_LENGTH
// (Deno can't resolve a relative import reaching outside supabase/functions/
// — confirmed while building ticket 02), so it hand-duplicates the number.
// This guards against the two silently drifting apart with no compiler tie
// between them.
describe("MIN_PASSWORD_LENGTH stays in sync across the Deno boundary", () => {
  it("matches between registerValidation.ts and admin-accounts/index.ts", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const dir = fileURLToPath(new URL(".", import.meta.url));

    const validationSource = await readFile(
      `${dir}/../registerValidation.ts`,
      "utf-8",
    );
    const edgeFunctionSource = await readFile(
      `${dir}/../../../supabase/functions/admin-accounts/index.ts`,
      "utf-8",
    );

    const validationMatch = validationSource.match(/MIN_PASSWORD_LENGTH = (\d+)/);
    const edgeFunctionMatch = edgeFunctionSource.match(/MIN_PASSWORD_LENGTH = (\d+)/);

    expect(validationMatch).not.toBeNull();
    expect(edgeFunctionMatch).not.toBeNull();
    expect(edgeFunctionMatch?.[1]).toBe(validationMatch?.[1]);
  });
});

describe("clarkApi.deleteAccount", () => {
  it("cascades to remove the target Account's profile and Lessons", async () => {
    const targetId = await ensureFixtureAccount(
      "accounts-delete-target@clark.test",
      "student",
      "Delete Target",
    );
    const { error: lessonError } = await serviceRoleClient.from("lessons").insert({
      title: "Owned By Target",
      content: "Content.",
      subject: "Test",
      visibility: "public",
      owner_id: targetId,
    });
    if (lessonError) throw lessonError;

    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    await deleteAccount(targetId);

    const { data: profileRow } = await serviceRoleClient
      .from("profiles")
      .select("id")
      .eq("id", targetId)
      .maybeSingle();
    expect(profileRow).toBeNull();

    const { data: lessonRows } = await serviceRoleClient
      .from("lessons")
      .select("id")
      .eq("owner_id", targetId);
    expect(lessonRows).toEqual([]);
  });

  it("rejects an Admin deleting their own Account", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    await expect(deleteAccount(adminId)).rejects.toThrow(/own Account/);

    const { data } = await serviceRoleClient
      .from("profiles")
      .select("id")
      .eq("id", adminId)
      .maybeSingle();
    expect(data).not.toBeNull();
  });

  it("is rejected for a Student", async () => {
    const targetId = await ensureFixtureAccount(
      "accounts-delete-unauthorized@clark.test",
      "student",
      "Unauthorized Target",
    );
    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    await expect(deleteAccount(targetId)).rejects.toThrow();
  });
});

describe("clarkApi.requestPasswordReset", () => {
  it("sends a real password-reset email", async () => {
    await requestPasswordReset(STUDENT_EMAIL);
    expect(await findEmailTo(STUDENT_EMAIL)).not.toBeNull();
  });
});
