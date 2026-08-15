import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { login, logout, publishTest } from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const OWNER_EMAIL = "publish-test-owner@clark.test";
const OTHER_EMAIL = "publish-test-other@clark.test";

let ownerId: string;

beforeAll(async () => {
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Publish Owner");
  await ensureFixtureAccount(OTHER_EMAIL, "student", "Publish Other");
});

afterEach(async () => {
  await logout();
});

async function seedLesson(): Promise<string> {
  const { data, error } = await serviceRoleClient
    .from("lessons")
    .insert({
      title: "Lesson With Test",
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

describe("clarkApi.publishTest", () => {
  it("replaces rather than appends across two publishes on the same Lesson", async () => {
    const id = await seedLesson();
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);

    await publishTest(id, [
      { question: "First round Q1", options: ["A", "B"], answer: "A" },
      { question: "First round Q2", options: ["A", "B"], answer: "B" },
    ]);

    const second = await publishTest(id, [
      { question: "Second round Q1", options: ["X", "Y"], answer: "Y" },
    ]);

    expect(second.test).toEqual([
      { question: "Second round Q1", options: ["X", "Y"], answer: "Y" },
    ]);

    const { data } = await serviceRoleClient
      .from("lessons")
      .select("test")
      .eq("id", id)
      .single();
    expect(data?.test).toEqual([
      { question: "Second round Q1", options: ["X", "Y"], answer: "Y" },
    ]);
  });

  it("is rejected by RLS for a non-owner, non-admin Account", async () => {
    const id = await seedLesson();
    await login(OTHER_EMAIL, FIXTURE_PASSWORD);

    await expect(
      publishTest(id, [
        { question: "Hijack Q1", options: ["A", "B"], answer: "A" },
      ]),
    ).rejects.toThrow();

    const { data } = await serviceRoleClient
      .from("lessons")
      .select("test")
      .eq("id", id)
      .single();
    expect(data?.test).toBeNull();
  });
});
