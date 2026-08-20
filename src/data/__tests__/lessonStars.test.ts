import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { getMyStarredLessonIds, login, logout, toggleLessonStar } from "../clarkApi";
import { supabase } from "../supabaseClient";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const OWNER_EMAIL = "star-owner@clark.test";
const STUDENT_A_EMAIL = "star-student-a@clark.test";
const STUDENT_B_EMAIL = "star-student-b@clark.test";
const ADMIN_EMAIL = "star-admin@clark.test";

let ownerId: string;

beforeAll(async () => {
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Star Owner");
  await ensureFixtureAccount(STUDENT_A_EMAIL, "student", "Star Student A");
  await ensureFixtureAccount(STUDENT_B_EMAIL, "student", "Star Student B");
  await ensureFixtureAccount(ADMIN_EMAIL, "admin", "Star Admin");
});

afterEach(async () => {
  await logout();
});

async function seedLesson(
  overrides: Partial<{ visibility: "public" | "private" }> = {},
): Promise<string> {
  const { data, error } = await serviceRoleClient
    .from("lessons")
    .insert({
      title: "Star Fixture Lesson",
      content: "Content.",
      subject: "Test",
      visibility: "public",
      owner_id: ownerId,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function starCount(lessonId: string): Promise<number> {
  const { data, error } = await serviceRoleClient
    .from("lessons")
    .select("star_count")
    .eq("id", lessonId)
    .single();
  if (error) throw error;
  return data.star_count;
}

async function rowCount(lessonId: string): Promise<number> {
  const { count, error } = await serviceRoleClient
    .from("lesson_stars")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);
  if (error) throw error;
  return count ?? 0;
}

describe("clarkApi.toggleLessonStar", () => {
  it("stars a public Lesson, incrementing star_count", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    const result = await toggleLessonStar(id);

    expect(result).toEqual({ starred: true, star_count: 1 });
    expect(await starCount(id)).toBe(1);
    expect(await rowCount(id)).toBe(1);
  });

  it("un-stars on a second toggle, decrementing star_count back to 0", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    await toggleLessonStar(id);
    const result = await toggleLessonStar(id);

    expect(result).toEqual({ starred: false, star_count: 0 });
    expect(await starCount(id)).toBe(0);
    expect(await rowCount(id)).toBe(0);
  });

  it("keeps star_count in sync across multiple Accounts starring the same Lesson", async () => {
    const id = await seedLesson();

    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    await toggleLessonStar(id);
    await logout();

    await login(STUDENT_B_EMAIL, FIXTURE_PASSWORD);
    await toggleLessonStar(id);
    expect(await starCount(id)).toBe(2);

    // Student B un-stars; Student A's Star is untouched.
    await toggleLessonStar(id);
    expect(await starCount(id)).toBe(1);
  });

  it("succeeds for the owner starring their own private Lesson", async () => {
    const id = await seedLesson({ visibility: "private" });
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const result = await toggleLessonStar(id);

    expect(result).toEqual({ starred: true, star_count: 1 });
  });

  it("succeeds for an Admin starring a private Lesson they don't own", async () => {
    const id = await seedLesson({ visibility: "private" });
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);

    const result = await toggleLessonStar(id);

    expect(result).toEqual({ starred: true, star_count: 1 });
  });

  it("is rejected for a private Lesson the caller can't view", async () => {
    const id = await seedLesson({ visibility: "private" });
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    await expect(toggleLessonStar(id)).rejects.toThrow();
    expect(await rowCount(id)).toBe(0);
  });
});

describe("lesson_stars unique constraint", () => {
  it("rejects a second row for the same (lesson, Account) pair", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;

    const first = await supabase
      .from("lesson_stars")
      .insert({ lesson_id: id, user_id: userId });
    expect(first.error).toBeNull();

    const second = await supabase
      .from("lesson_stars")
      .insert({ lesson_id: id, user_id: userId });
    expect(second.error).not.toBeNull();

    expect(await rowCount(id)).toBe(1);
  });
});

describe("lesson_stars RLS boundary", () => {
  it("hides another Account's Star row from select, but not an Admin's", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    await toggleLessonStar(id);
    await logout();

    await login(STUDENT_B_EMAIL, FIXTURE_PASSWORD);
    const { data: asOther } = await supabase
      .from("lesson_stars")
      .select("id")
      .eq("lesson_id", id);
    expect(asOther).toEqual([]);
    await logout();

    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    const { data: asAdmin } = await supabase
      .from("lesson_stars")
      .select("id")
      .eq("lesson_id", id);
    expect(asAdmin).toHaveLength(1);
  });

  it("blocks an Account from deleting another Account's Star row", async () => {
    const id = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    await toggleLessonStar(id);
    await logout();

    await login(STUDENT_B_EMAIL, FIXTURE_PASSWORD);
    const { error, count } = await supabase
      .from("lesson_stars")
      .delete({ count: "exact" })
      .eq("lesson_id", id);
    expect(error === null && count === 0).toBe(true);

    expect(await rowCount(id)).toBe(1);
  });
});

describe("clarkApi.getMyStarredLessonIds", () => {
  it("returns only the Lessons the caller has starred", async () => {
    const starred = await seedLesson();
    const notStarred = await seedLesson();
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    await toggleLessonStar(starred);

    const ids = await getMyStarredLessonIds([starred, notStarred]);

    expect(ids).toEqual(new Set([starred]));
  });

  it("returns an empty set for an empty input list without querying", async () => {
    await login(STUDENT_A_EMAIL, FIXTURE_PASSWORD);
    expect(await getMyStarredLessonIds([])).toEqual(new Set());
  });
});
