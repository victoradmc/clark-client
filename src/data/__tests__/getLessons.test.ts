import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { getLessons, login, logout } from "../clarkApi";
import { ensureFixtureAccount, FIXTURE_PASSWORD, serviceRoleClient } from "./support";

const OWNER_EMAIL = "hub-owner@clark.test";
const OTHER_EMAIL = "hub-other@clark.test";

let ownerId: string;

beforeAll(async () => {
  ownerId = await ensureFixtureAccount(OWNER_EMAIL, "student", "Hub Owner");
  const otherId = await ensureFixtureAccount(OTHER_EMAIL, "student", "Hub Other");

  // ensureFixtureAccount is idempotent across repeated runs against the
  // persistent local DB, but Lesson rows aren't — clear this fixture's own
  // Lessons first so re-running the suite doesn't duplicate them.
  const { error: deleteError } = await serviceRoleClient
    .from("lessons")
    .delete()
    .in("owner_id", [ownerId, otherId]);
  if (deleteError) throw deleteError;

  const { error } = await serviceRoleClient.from("lessons").insert([
    {
      title: "Cell Biology Basics",
      content: "Content.",
      subject: "Biology",
      visibility: "public",
      owner_id: ownerId,
    },
    {
      title: "Cell Signaling Overview",
      content: "Content.",
      subject: "Biology",
      visibility: "public",
      owner_id: ownerId,
    },
    {
      title: "Owner Private Notes",
      content: "Content.",
      subject: "Chemistry",
      visibility: "private",
      owner_id: ownerId,
    },
    {
      title: "Algebra Refresher",
      content: "Content.",
      subject: "Math",
      visibility: "public",
      owner_id: otherId,
    },
    {
      title: "Other's Private Notes",
      content: "Content.",
      subject: "Math",
      visibility: "private",
      owner_id: otherId,
    },
  ]);
  if (error) throw error;
});

afterEach(async () => {
  await logout();
});

describe("clarkApi.getLessons", () => {
  it("public tab lists every public Lesson regardless of owner, excluding private ones", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    const titles = (await getLessons({ tab: "public" })).map((l) => l.title);
    // The local Supabase instance is shared and persistent across test
    // files, so other suites' public fixture Lessons may also be present —
    // assert this fixture's set is included rather than an exact list.
    expect(titles).toEqual(
      expect.arrayContaining([
        "Algebra Refresher",
        "Cell Biology Basics",
        "Cell Signaling Overview",
      ]),
    );
    expect(titles).not.toContain("Owner Private Notes");
    expect(titles).not.toContain("Other's Private Notes");
  });

  it("mine tab lists only the caller's own Lessons, including their private ones, excluding others'", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    const lessons = await getLessons({ tab: "mine" });
    const titles = lessons.map((l) => l.title).sort();
    expect(titles).toEqual([
      "Cell Biology Basics",
      "Cell Signaling Overview",
      "Owner Private Notes",
    ]);
  });

  it("search filters the current tab by a case-insensitive title substring", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    const lessons = await getLessons({ tab: "public", search: "cell" });
    const titles = lessons.map((l) => l.title).sort();
    expect(titles).toEqual(["Cell Biology Basics", "Cell Signaling Overview"]);
  });

  it("subject filters the current tab to an exact Subject match", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    const lessons = await getLessons({ tab: "public", subject: "Math" });
    expect(lessons.map((l) => l.title)).toEqual(["Algebra Refresher"]);
  });

  it("combines tab and subject: mine tab narrowed to a subject only the caller's private Lesson has", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    const lessons = await getLessons({ tab: "mine", subject: "Chemistry" });
    expect(lessons.map((l) => l.title)).toEqual(["Owner Private Notes"]);
  });

  it("search never surfaces a private Lesson through the public tab, own or another's", async () => {
    await login(OTHER_EMAIL, FIXTURE_PASSWORD);
    const lessons = await getLessons({ tab: "public", search: "private" });
    expect(lessons).toEqual([]);
  });
});
