import { beforeAll, afterEach, describe, expect, it } from "vitest";
import { login, logout } from "../clarkApi";
import { supabase } from "../supabaseClient";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const OWNER_EMAIL = "lesson-owner@clark.test";
const OTHER_EMAIL = "lesson-other@clark.test";
const ADMIN_EMAIL = "lesson-admin@clark.test";

let lessonId: string;

beforeAll(async () => {
  const ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Owner");
  await ensureFixtureAccount(OTHER_EMAIL, "student", "Other Student");
  await ensureFixtureAccount(ADMIN_EMAIL, "admin", "Admin");

  const { data, error } = await serviceRoleClient
    .from("lessons")
    .insert({
      title: "Private Fixture Lesson",
      content: "Fixture content.",
      subject: "Test",
      visibility: "private",
      owner_id: ownerId,
    })
    .select("id")
    .single();
  if (error) throw error;
  lessonId = data.id;
});

afterEach(async () => {
  await logout();
});

async function canSeeLesson(): Promise<boolean> {
  const { data, error } = await supabase
    .from("lessons")
    .select("id")
    .eq("id", lessonId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

describe("private lesson visibility (RLS)", () => {
  it("is visible to its owner", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    expect(await canSeeLesson()).toBe(true);
  });

  it("is visible to an Admin", async () => {
    await login(ADMIN_EMAIL, FIXTURE_PASSWORD);
    expect(await canSeeLesson()).toBe(true);
  });

  it("is not visible to a non-owner Student", async () => {
    await login(OTHER_EMAIL, FIXTURE_PASSWORD);
    expect(await canSeeLesson()).toBe(false);
  });
});
