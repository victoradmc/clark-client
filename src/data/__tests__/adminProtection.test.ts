import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { login, logout } from "../clarkApi";
import { supabase } from "../supabaseClient";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const STUDENT_EMAIL = "protection-student@clark.test";
const ADMIN1_EMAIL = "protection-admin1@clark.test";
const ADMIN2_EMAIL = "protection-admin2@clark.test";

let studentId: string;
let admin1Id: string;

beforeAll(async () => {
  studentId = await ensureFixtureAccount(STUDENT_EMAIL, "student", "Student");
  admin1Id = await ensureFixtureAccount(ADMIN1_EMAIL, "admin", "Admin One");
  await ensureFixtureAccount(ADMIN2_EMAIL, "admin", "Admin Two");
});

afterEach(async () => {
  await logout();
});

describe("profiles role protections", () => {
  it("blocks a Student from promoting themselves to admin", async () => {
    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    const { error } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", studentId);
    expect(error).not.toBeNull();

    const { data } = await serviceRoleClient
      .from("profiles")
      .select("role")
      .eq("id", studentId)
      .single();
    expect(data?.role).toBe("student");
  });

  it("blocks a Student from updating another Account's profile", async () => {
    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    const { error, count } = await supabase
      .from("profiles")
      .update({ name: "Hijacked" }, { count: "exact" })
      .eq("id", admin1Id);
    expect(error === null && count === 0).toBe(true);
  });

  it("blocks an Admin from removing their own admin role", async () => {
    await login(ADMIN1_EMAIL, FIXTURE_PASSWORD);
    const { error } = await supabase
      .from("profiles")
      .update({ role: "student" })
      .eq("id", admin1Id);
    expect(error).not.toBeNull();
  });

  it("allows an Admin to demote a peer Admin when another Admin remains", async () => {
    await login(ADMIN2_EMAIL, FIXTURE_PASSWORD);
    const { error } = await supabase
      .from("profiles")
      .update({ role: "student" })
      .eq("id", admin1Id);
    expect(error).toBeNull();

    // restore fixture state for reruns against the persistent local DB
    const { error: restoreError } = await serviceRoleClient
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", admin1Id);
    expect(restoreError).toBeNull();
  });

  it("blocks removing the admin role from the last remaining admin, even via service_role", async () => {
    const soleAdminId = await ensureFixtureAccount(
      "protection-sole-admin@clark.test",
      "admin",
      "Sole Admin",
    );
    // The last-admin count is global, and other test files' fixtures (e.g.
    // lessonVisibility.test.ts's Admin) share this same local DB — so
    // demote every admin except soleAdminId, not just this file's two.
    const { data: otherAdmins, error: otherAdminsError } =
      await serviceRoleClient
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .neq("id", soleAdminId);
    if (otherAdminsError) throw otherAdminsError;
    const otherAdminIds = otherAdmins.map((a) => a.id);

    try {
      await serviceRoleClient
        .from("profiles")
        .update({ role: "student" })
        .in("id", otherAdminIds);

      const { error: demoteError } = await serviceRoleClient
        .from("profiles")
        .update({ role: "student" })
        .eq("id", soleAdminId);
      expect(demoteError).not.toBeNull();

      const { error: deleteError } = await serviceRoleClient
        .from("profiles")
        .delete()
        .eq("id", soleAdminId);
      expect(deleteError).not.toBeNull();
    } finally {
      // restore fixture state for reruns against the persistent local DB
      await serviceRoleClient
        .from("profiles")
        .update({ role: "admin" })
        .in("id", otherAdminIds);
    }
  });
});
