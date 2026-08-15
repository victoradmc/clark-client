import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createLesson, login, logout } from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const OWNER_EMAIL = "create-lesson-owner@clark.test";
let ownerId: string;

beforeAll(async () => {
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Lesson Author");
});

afterEach(async () => {
  await logout();
});

describe("clarkApi.createLesson", () => {
  it("rejects JSON missing title/content/subject with the expected error", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    await expect(
      createLesson({
        title: "Only a title",
        content: undefined,
        subject: undefined,
        visibility: "private",
      }),
    ).rejects.toThrowError(/Missing required field/);
  });

  it("accepts valid JSON, producing a row with owner_id set to the caller", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    const lesson = await createLesson({
      title: "Photosynthesis Basics",
      content: "## Overview\nPlants convert light into energy.",
      subject: "Biology",
      origin: "Video: bio-101.mp4",
      visibility: "public",
    });

    expect(lesson.owner_id).toBe(ownerId);
    expect(lesson.title).toBe("Photosynthesis Basics");
    expect(lesson.subject).toBe("Biology");
    expect(lesson.origin).toBe("Video: bio-101.mp4");
    expect(lesson.visibility).toBe("public");

    const { data } = await serviceRoleClient
      .from("lessons")
      .select("owner_id")
      .eq("id", lesson.id)
      .single();
    expect(data?.owner_id).toBe(ownerId);
  });

  it("defaults origin to Unknown when omitted", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    const lesson = await createLesson({
      title: "No Origin Lesson",
      content: "Content.",
      subject: "Test",
      visibility: "private",
    });
    expect(lesson.origin).toBe("Unknown");
  });
});
