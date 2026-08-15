import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { deleteLesson, login, logout, updateLesson } from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const OWNER_EMAIL = "manage-lesson-owner@clark.test";
const OTHER_EMAIL = "manage-lesson-other@clark.test";

let ownerId: string;

beforeAll(async () => {
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Manage Owner");
  await ensureFixtureAccount(OTHER_EMAIL, "student", "Manage Other");
});

afterEach(async () => {
  await logout();
});

async function seedLesson(): Promise<string> {
  const { data, error } = await serviceRoleClient
    .from("lessons")
    .insert({
      title: "Original Title",
      content: "Content.",
      subject: "Test",
      visibility: "public",
      owner_id: ownerId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

describe("clarkApi.updateLesson", () => {
  it("succeeds for the owner, updating title and visibility", async () => {
    const id = await seedLesson();
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const updated = await updateLesson(id, {
      title: "Updated Title",
      visibility: "private",
    });

    expect(updated.title).toBe("Updated Title");
    expect(updated.visibility).toBe("private");

    const { data } = await serviceRoleClient
      .from("lessons")
      .select("title, visibility")
      .eq("id", id)
      .single();
    expect(data?.title).toBe("Updated Title");
    expect(data?.visibility).toBe("private");
  });

  it("is rejected by RLS for a non-owner, non-admin Account", async () => {
    const id = await seedLesson();
    await login(OTHER_EMAIL, FIXTURE_PASSWORD);

    await expect(
      updateLesson(id, { title: "Hijacked Title", visibility: "private" }),
    ).rejects.toThrow();

    const { data } = await serviceRoleClient
      .from("lessons")
      .select("title")
      .eq("id", id)
      .single();
    expect(data?.title).toBe("Original Title");
  });
});

describe("clarkApi.deleteLesson", () => {
  it("succeeds for the owner", async () => {
    const id = await seedLesson();
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    await deleteLesson(id);

    const { data } = await serviceRoleClient
      .from("lessons")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("is rejected by RLS for a non-owner, non-admin Account", async () => {
    const id = await seedLesson();
    await login(OTHER_EMAIL, FIXTURE_PASSWORD);

    await expect(deleteLesson(id)).rejects.toThrow();

    const { data } = await serviceRoleClient
      .from("lessons")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    expect(data).not.toBeNull();
  });
});
