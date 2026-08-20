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

  // A separate, isolated batch for sort-specific assertions: distinct
  // Subject so these queries never mix with the fixtures above or with
  // other suites' cross-file Lessons (the local Supabase instance is
  // shared/persistent — see the "public tab" test's comment), and explicit
  // `created_at` timestamps (service_role bypasses the column default) so
  // "newest" ordering and the "mostStarred" tie-break are deterministic
  // rather than racing on `now()` at insert time.
  const base = new Date("2026-01-01T00:00:00Z").getTime();
  const at = (offsetSeconds: number) =>
    new Date(base + offsetSeconds * 1000).toISOString();

  const { error: sortError } = await serviceRoleClient.from("lessons").insert([
    {
      title: "Sort Fixture High Star",
      content: "Content.",
      subject: "Sort Fixture",
      visibility: "public",
      owner_id: ownerId,
      star_count: 5,
      created_at: at(0),
    },
    {
      title: "Sort Fixture Low Star",
      content: "Content.",
      subject: "Sort Fixture",
      visibility: "public",
      owner_id: ownerId,
      star_count: 1,
      created_at: at(1),
    },
    {
      title: "Sort Fixture Tie Older",
      content: "Content.",
      subject: "Sort Fixture",
      visibility: "public",
      owner_id: ownerId,
      star_count: 3,
      created_at: at(2),
    },
    {
      title: "Sort Fixture Tie Newer",
      content: "Content.",
      subject: "Sort Fixture",
      visibility: "public",
      owner_id: ownerId,
      star_count: 3,
      created_at: at(3),
    },
  ]);
  if (sortError) throw sortError;
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
    // Excludes the "Sort Fixture" subject batch seeded above (also owned by
    // OWNER_EMAIL, for the sort-specific tests below) — this test only
    // cares about the original three-Lesson fixture.
    const titles = lessons
      .map((l) => l.title)
      .filter((t) => !t.startsWith("Sort Fixture"))
      .sort();
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

  it("defaults to newest-first when no sort is given", async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    const lessons = await getLessons({ tab: "public", subject: "Sort Fixture" });
    expect(lessons.map((l) => l.title)).toEqual([
      "Sort Fixture Tie Newer",
      "Sort Fixture Tie Older",
      "Sort Fixture Low Star",
      "Sort Fixture High Star",
    ]);
  });

  // Expected order for the "Sort Fixture" batch under sort: "mostStarred" —
  // star_count descending (5, 3, 3, 1), the tie between the two 3-star
  // Lessons broken by newest — shared by both tests below so the ordering
  // is asserted once, not re-derived per test.
  const MOST_STARRED_ORDER = [
    "Sort Fixture High Star",
    "Sort Fixture Tie Newer",
    "Sort Fixture Tie Older",
    "Sort Fixture Low Star",
  ];

  it('sort: "mostStarred" orders by star_count descending, tie-broken by newest', async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    const lessons = await getLessons({
      tab: "public",
      subject: "Sort Fixture",
      sort: "mostStarred",
    });
    expect(lessons.map((l) => l.title)).toEqual(MOST_STARRED_ORDER);
  });

  it('sort: "mostStarred" composes with the mine tab and search', async () => {
    await login(OWNER_EMAIL, FIXTURE_PASSWORD);
    const lessons = await getLessons({
      tab: "mine",
      search: "sort fixture",
      sort: "mostStarred",
    });
    expect(lessons.map((l) => l.title)).toEqual(MOST_STARRED_ORDER);
  });
});

describe('clarkApi.getLessons — tab: "starred"', () => {
  const STARRER_EMAIL = "hub-starrer@clark.test";
  let starrerId: string;
  let starredLessonId: string;
  let unstarredLessonId: string;

  beforeAll(async () => {
    starrerId = await ensureFixtureAccount(STARRER_EMAIL, "student", "Hub Starrer");

    // Its own Subject, isolated from every other fixture batch in this
    // file — inserting real lesson_stars rows below drives the star_count
    // trigger for real, which would otherwise perturb the "Sort Fixture"
    // batch's hand-set star_count values the mostStarred tests above rely
    // on.
    const { data, error } = await serviceRoleClient
      .from("lessons")
      .insert([
        {
          title: "Starred Fixture A",
          content: "Content.",
          subject: "Starred Fixture",
          visibility: "public",
          owner_id: ownerId,
        },
        {
          title: "Starred Fixture B",
          content: "Content.",
          subject: "Starred Fixture",
          visibility: "public",
          owner_id: ownerId,
        },
      ])
      .select("id, title");
    if (error) throw error;
    starredLessonId = data.find((l) => l.title === "Starred Fixture A")!.id;
    unstarredLessonId = data.find((l) => l.title === "Starred Fixture B")!.id;

    const { error: starError } = await serviceRoleClient
      .from("lesson_stars")
      .insert({ lesson_id: starredLessonId, user_id: starrerId });
    if (starError) throw starError;
  });

  it("lists only Lessons the caller has starred, isolated from public/mine results", async () => {
    await login(STARRER_EMAIL, FIXTURE_PASSWORD);

    const starred = await getLessons({ tab: "starred", subject: "Starred Fixture" });
    expect(starred.map((l) => l.title)).toEqual(["Starred Fixture A"]);

    const publicList = await getLessons({ tab: "public", subject: "Starred Fixture" });
    expect(publicList.map((l) => l.title).sort()).toEqual([
      "Starred Fixture A",
      "Starred Fixture B",
    ]);

    // The starrer doesn't own either Lesson — the starred tab is not the
    // same set as "mine".
    const mine = await getLessons({ tab: "mine", subject: "Starred Fixture" });
    expect(mine).toEqual([]);
  });

  it("never includes a Lesson the caller hasn't starred, even if it's otherwise visible", async () => {
    await login(STARRER_EMAIL, FIXTURE_PASSWORD);
    const starred = await getLessons({ tab: "starred", subject: "Starred Fixture" });
    expect(starred.map((l) => l.id)).not.toContain(unstarredLessonId);
  });

  it('sort: "recentlyStarred" orders by when the caller starred each Lesson, most recent first', async () => {
    const { data, error } = await serviceRoleClient
      .from("lessons")
      .insert([
        {
          title: "Recency Fixture Oldest Star",
          content: "Content.",
          subject: "Recency Fixture",
          visibility: "public",
          owner_id: ownerId,
        },
        {
          title: "Recency Fixture Newest Star",
          content: "Content.",
          subject: "Recency Fixture",
          visibility: "public",
          owner_id: ownerId,
        },
      ])
      .select("id, title");
    if (error) throw error;
    const oldestId = data.find((l) => l.title === "Recency Fixture Oldest Star")!.id;
    const newestId = data.find((l) => l.title === "Recency Fixture Newest Star")!.id;

    const base = new Date("2026-02-01T00:00:00Z").getTime();
    const { error: starError } = await serviceRoleClient.from("lesson_stars").insert([
      {
        lesson_id: oldestId,
        user_id: starrerId,
        created_at: new Date(base).toISOString(),
      },
      {
        lesson_id: newestId,
        user_id: starrerId,
        created_at: new Date(base + 1000).toISOString(),
      },
    ]);
    if (starError) throw starError;

    await login(STARRER_EMAIL, FIXTURE_PASSWORD);
    const lessons = await getLessons({
      tab: "starred",
      subject: "Recency Fixture",
      sort: "recentlyStarred",
    });
    expect(lessons.map((l) => l.title)).toEqual([
      "Recency Fixture Newest Star",
      "Recency Fixture Oldest Star",
    ]);
  });

  it("a Lesson deleted by its owner disappears from the starred tab (lesson_stars cascade)", async () => {
    const { data, error } = await serviceRoleClient
      .from("lessons")
      .insert({
        title: "Cascade Fixture",
        content: "Content.",
        subject: "Cascade Fixture",
        visibility: "public",
        owner_id: ownerId,
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: starError } = await serviceRoleClient
      .from("lesson_stars")
      .insert({ lesson_id: data.id, user_id: starrerId });
    if (starError) throw starError;

    await login(STARRER_EMAIL, FIXTURE_PASSWORD);
    const before = await getLessons({ tab: "starred", subject: "Cascade Fixture" });
    expect(before.map((l) => l.title)).toEqual(["Cascade Fixture"]);

    const { error: deleteError } = await serviceRoleClient
      .from("lessons")
      .delete()
      .eq("id", data.id);
    if (deleteError) throw deleteError;

    const after = await getLessons({ tab: "starred", subject: "Cascade Fixture" });
    expect(after).toEqual([]);
  });
});
