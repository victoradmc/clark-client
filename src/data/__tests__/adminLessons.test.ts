import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { deleteLesson, getAllLessons, login, logout } from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const ADMIN_EMAIL = "admin-lessons-admin@clark.test";
const OWNER_EMAIL = "admin-lessons-owner@clark.test";
const STUDENT_EMAIL = "admin-lessons-student@clark.test";

let adminId: string;
let ownerId: string;

beforeAll(async () => {
  adminId = await ensureFixtureAccount(ADMIN_EMAIL, "admin", "Lessons Admin");
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Lessons Owner");
  await ensureFixtureAccount(STUDENT_EMAIL, "student", "Lessons Student");

  // ensureFixtureAccount is idempotent, Lesson rows aren't — clear this
  // fixture's own Lessons first so re-running the suite doesn't duplicate.
  const { error: deleteError } = await serviceRoleClient
    .from("lessons")
    .delete()
    .in("owner_id", [adminId, ownerId]);
  if (deleteError) throw deleteError;

  const { error } = await serviceRoleClient.from("lessons").insert([
    {
      title: "Admin Moderation Public",
      content: "Content.",
      subject: "Moderation",
      visibility: "public",
      owner_id: ownerId,
    },
    {
      title: "Admin Moderation Private",
      content: "Content.",
      subject: "Moderation",
      visibility: "private",
      owner_id: ownerId,
    },
  ]);
  if (error) throw error;
});

afterEach(async () => {
  await logout();
});

describe("clarkApi.getAllLessons", () => {
  it("lists every Lesson platform-wide for an Admin, regardless of ownership or Visibility", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const titles = (await getAllLessons()).map((l) => l.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "Admin Moderation Public",
        "Admin Moderation Private",
      ]),
    );
  });

  it("searches by a case-insensitive substring of title or subject", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const byTitle = await getAllLessons("moderation public");
    expect(byTitle.map((l) => l.title)).toEqual(["Admin Moderation Public"]);

    const bySubject = await getAllLessons("moderation");
    expect(bySubject.map((l) => l.title)).toEqual(
      expect.arrayContaining([
        "Admin Moderation Public",
        "Admin Moderation Private",
      ]),
    );
  });

  it("is scoped by RLS for a non-admin — a private Lesson owned by someone else never appears", async () => {
    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    const titles = (await getAllLessons()).map((l) => l.title);
    expect(titles).toContain("Admin Moderation Public");
    expect(titles).not.toContain("Admin Moderation Private");
  });
});

describe("clarkApi.deleteLesson as Admin", () => {
  it("succeeds on a Lesson owned by a different Account", async () => {
    const { data, error } = await serviceRoleClient
      .from("lessons")
      .insert({
        title: "Admin Deletes This",
        content: "Content.",
        subject: "Moderation",
        visibility: "public",
        owner_id: ownerId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    await deleteLesson(data.id);

    const { data: row } = await serviceRoleClient
      .from("lessons")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    expect(row).toBeNull();
  });

  it("is rejected for a Student on a Lesson they don't own", async () => {
    const { data, error } = await serviceRoleClient
      .from("lessons")
      .insert({
        title: "Student Cannot Delete This",
        content: "Content.",
        subject: "Moderation",
        visibility: "public",
        owner_id: ownerId,
      })
      .select("id")
      .single();
    if (error) throw error;

    await login(STUDENT_EMAIL, FIXTURE_PASSWORD);
    await expect(deleteLesson(data.id)).rejects.toThrow();

    const { data: row } = await serviceRoleClient
      .from("lessons")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    expect(row).not.toBeNull();
  });
});
