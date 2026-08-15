import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  deleteAccount,
  getAccounts,
  inviteAccount,
  login,
  logout,
  requestPasswordReset,
  updateAccountRole,
} from "../clarkApi";
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

describe("clarkApi.inviteAccount", () => {
  const INVITE_EMAIL = "accounts-invitee@clark.test";

  afterEach(async () => {
    const { data: list } = await serviceRoleClient.auth.admin.listUsers();
    const existing = list.users.find((u) => u.email === INVITE_EMAIL);
    if (existing) await serviceRoleClient.auth.admin.deleteUser(existing.id);
  });

  it("creates a profile and sends a real invite email", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const account = await inviteAccount({
      name: "New Invitee",
      email: INVITE_EMAIL,
      role: "student",
    });

    expect(account.email).toBe(INVITE_EMAIL);
    expect(account.role).toBe("student");
    expect(account.status).toBe("invited");

    const { data: profileRow } = await serviceRoleClient
      .from("profiles")
      .select("name, email, role")
      .eq("id", account.id)
      .single();
    expect(profileRow).toEqual({
      name: "New Invitee",
      email: INVITE_EMAIL,
      role: "student",
    });

    expect(await findEmailTo(INVITE_EMAIL)).not.toBeNull();
  });

  it("is rejected for a Student", async () => {
    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    await expect(
      inviteAccount({ name: "X", email: INVITE_EMAIL, role: "student" }),
    ).rejects.toThrow();
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
