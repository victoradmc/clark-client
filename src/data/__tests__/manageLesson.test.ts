import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  deleteLesson,
  login,
  logout,
  updateLesson,
  type LessonVisibility,
} from "../clarkApi";
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

async function seedLesson(
  overrides: Partial<{
    title: string;
    content: string;
    subject: string;
    origin: string;
    visibility: LessonVisibility;
    test: unknown;
  }> = {},
): Promise<string> {
  const { data, error } = await serviceRoleClient
    .from("lessons")
    .insert({
      title: "Original Title",
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

describe("clarkApi.updateLesson", () => {
  it("succeeds for the owner, updating title and visibility", async () => {
    const id = await seedLesson();
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const updated = await updateLesson(id, {
      title: "Updated Title",
      content: "Content.",
      subject: "Test",
      origin: "Unknown",
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

  it("updates subject, origin, and content together and persists the new values", async () => {
    const id = await seedLesson();
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    const updated = await updateLesson(id, {
      title: "Original Title",
      content: "Rewritten content.",
      subject: "Chemistry",
      origin: "Video: reactions.mp4",
      visibility: "public",
    });

    expect(updated.subject).toBe("Chemistry");
    expect(updated.origin).toBe("Video: reactions.mp4");
    expect(updated.content).toBe("Rewritten content.");

    const { data } = await serviceRoleClient
      .from("lessons")
      .select("subject, origin, content")
      .eq("id", id)
      .single();
    expect(data?.subject).toBe("Chemistry");
    expect(data?.origin).toBe("Video: reactions.mp4");
    expect(data?.content).toBe("Rewritten content.");
  });

  it("leaves an existing Test's stored value unchanged when Content is updated", async () => {
    const test = [
      { question: "2+2?", options: ["3", "4"], answer: "4" },
    ];
    const id = await seedLesson({ test });
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    await updateLesson(id, {
      title: "Original Title",
      content: "Brand new content.",
      subject: "Test",
      origin: "Unknown",
      visibility: "public",
    });

    const { data } = await serviceRoleClient
      .from("lessons")
      .select("test")
      .eq("id", id)
      .single();
    expect(data?.test).toEqual(test);
  });

  it("rejects a blank Title, Content, or Subject with the same validation Lesson creation uses", async () => {
    const id = await seedLesson();
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    await expect(
      updateLesson(id, {
        title: "   ",
        content: "Content.",
        subject: "Test",
        origin: "Unknown",
        visibility: "public",
      }),
    ).rejects.toThrow();
  });

  it("is rejected by RLS for a non-owner, non-admin Account", async () => {
    const id = await seedLesson();
    await login(OTHER_EMAIL, FIXTURE_PASSWORD);

    await expect(
      updateLesson(id, {
        title: "Hijacked Title",
        content: "Content.",
        subject: "Test",
        origin: "Unknown",
        visibility: "private",
      }),
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
