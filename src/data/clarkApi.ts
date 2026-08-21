import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { validateCommentBody } from "./commentValidation";
import { validateLessonFields } from "./lessonValidation";
import { validateRegisterFields } from "./registerValidation";
import { validateTestFields } from "./testValidation";

export type { Session };

export type LessonVisibility = "public" | "private";

export type Question = {
  question: string;
  options: string[];
  answer: string;
};

export type Lesson = {
  id: string;
  title: string;
  content: string;
  subject: string;
  origin: string;
  visibility: LessonVisibility;
  owner_id: string;
  test: Question[] | null;
  created_at: string;
  star_count: number;
  notes_count: number;
};

export type Role = "student" | "admin";

export type Locale = "en" | "pt-BR";

export type Profile = {
  id: string;
  name: string;
  email: string;
  bio: string;
  role: Role;
  locale: Locale;
};

export async function login(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
}

// Thrown specifically for a duplicate-email Registration attempt, so
// LoginScreen can show a translated, specific message instead of a generic
// one (spec's duplicate-email decision) — every other register() failure
// surfaces as whatever Supabase Auth itself threw.
export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("This email is already registered.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

// Clark's other unauthenticated call (alongside login itself) — a
// signed-out visitor calls this directly from LoginScreen. Always produces
// a Student Account (ADR 0004): role is never sent here at all, it's
// hard-pinned server-side by the on_auth_user_created trigger. Returns no
// value — signUp() already leaves the caller signed in (email confirmation
// is disabled, see supabase/config.toml), and the existing
// onSessionChange/getSession machinery picks that session up the same way
// it does after login().
export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  const fields = validateRegisterFields(input);
  const { error } = await supabase.auth.signUp({
    email: fields.email,
    password: fields.password,
    options: { data: { name: fields.name } },
  });
  if (error) {
    if (error.code === "user_already_exists") throw new EmailAlreadyRegisteredError();
    throw error;
  }
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Notifies `callback` with the current session immediately, and again on
// every future sign-in/sign-out. Returns an unsubscribe function.
export function onSessionChange(
  callback: (session: Session | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}

export async function getProfile(): Promise<Profile> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("profiles")
    .select()
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  return data;
}

// `email` here is only the profiles.email display column, distinct from the
// Supabase Auth login email — the spec describes no self-service Auth email
// change flow (unlike password reset, which it calls out explicitly), so
// this is a plain RLS-gated field update, not an Auth account change.
export async function updateProfile(updates: {
  name: string;
  email: string;
  bio: string;
  locale: Locale;
}): Promise<Profile> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", session.user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// profiles has no owner-DELETE policy — rows are meant to be removed only
// via cascade from deleting auth.users (see the delete_own_account migration
// for why a security-definer RPC, not an Edge Function, is the right seam
// for a *self* delete). Cascades auth.users -> profiles -> lessons, then
// signs out locally since the session's Account no longer exists.
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw error;
  await logout();
}

// The unvalidated shape both createLesson and updateLesson accept — each
// then runs it through validateLessonFields, the single required-field/
// Origin-default rule set shared by Lesson creation and Manage's full edit.
type LessonFieldsInput = {
  title: unknown;
  content: unknown;
  subject: unknown;
  origin?: unknown;
  visibility: LessonVisibility;
};

export async function createLesson(input: LessonFieldsInput): Promise<Lesson> {
  const fields = validateLessonFields(input);
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");

  const { data, error } = await supabase
    .from("lessons")
    .insert({ ...fields, visibility: input.visibility, owner_id: session.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Shared by every getLessons branch below (public/mine, and both starred
// sub-paths) — narrows a Lessons query by title search and exact Subject,
// the two filters every tab/sort combination applies the same way.
function applyLessonFilters<
  Query extends { ilike(column: string, pattern: string): Query; eq(column: string, value: string): Query },
>(query: Query, search: string | undefined, subject: string | undefined): Query {
  let result = query;
  if (search) {
    result = result.ilike("title", `%${search}%`);
  }
  if (subject && subject !== "All subjects") {
    result = result.eq("subject", subject);
  }
  return result;
}

export type HubTab = "public" | "mine";

// The "starred" tab (ticket 03/My Library) reuses this same function rather
// than a separate "get my starred Lessons" call — the ticket's own
// no-separate-function decision — so this type is the union getLessons
// actually accepts, HubTab the narrower one the Hub's own tab toggle uses.
export type LessonTab = HubTab | "starred";

// "recentlyStarred" only makes sense combined with tab: "starred" (it orders
// by the caller's own lesson_stars.created_at, which only exists on rows
// that join survives) — My Library is the only caller that uses it.
export type LessonSort = "newest" | "mostStarred" | "recentlyStarred";

// Public tab: every Lesson with visibility = public, regardless of owner.
// Mine tab: every Lesson owned by the caller, regardless of visibility.
// Starred tab: every Lesson the caller has starred (inner-joins lesson_stars
// filtered to the caller's own rows — RLS further scopes that join to rows
// the caller could select anyway, so this can't leak another Account's
// stars). `search` matches title, case-insensitive substring. `subject`,
// when given and not "All subjects", narrows to an exact Subject match.
// `sort` defaults to "newest"; "mostStarred" orders by the denormalized
// `star_count` (ticket 01/ADR 0007) descending. Either way the trailing
// `created_at` order below always applies, so ties fall back to newest
// rather than an undefined order.
export async function getLessons(options: {
  tab: LessonTab;
  search?: string;
  subject?: string;
  sort?: LessonSort;
}): Promise<Lesson[]> {
  const search = options.search?.trim();

  // Kept as its own branch rather than folded into the tab-driven .eq()
  // below: the starred tab's inner-joined select() has to be a separate
  // literal string, not a value shared via a ternary/ variable — TypeScript
  // resolves postgrest-js's compile-time select() parser against this
  // function's `Promise<Lesson[]>` return type, and doing that across a
  // non-literal Query type spuriously fails the parser for both branches.
  if (options.tab === "starred") {
    const session = await getSession();
    if (!session) throw new Error("Not signed in.");

    // "recentlyStarred" can't be expressed as a lessons-table order() at
    // all: lesson_stars is a to-many relation from lessons' side (unique on
    // the (lesson_id, user_id) pair, not lesson_id alone), and PostgREST
    // refuses to order a parent query by a to-many embedded resource
    // ("A related order on 'lesson_stars' is not possible"), even though
    // the .eq() above narrows it to one row per Lesson at runtime. Instead:
    // fetch the caller's own lesson_stars rows already ordered by recency,
    // then fetch the matching Lessons and reorder them to match — .in()
    // itself doesn't preserve argument order.
    if (options.sort === "recentlyStarred") {
      const { data: stars, error: starsError } = await supabase
        .from("lesson_stars")
        .select("lesson_id")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (starsError) throw starsError;
      if (stars.length === 0) return [];

      const orderedIds = stars.map((s) => s.lesson_id as string);
      const query = applyLessonFilters(
        supabase.from("lessons").select("*").in("id", orderedIds),
        search,
        options.subject,
      );
      const { data, error } = await query;
      if (error) throw error;

      const byId = new Map((data as Lesson[]).map((l) => [l.id, l]));
      return orderedIds.flatMap((id) => byId.get(id) ?? []);
    }

    let query = applyLessonFilters(
      supabase
        .from("lessons")
        .select("*, lesson_stars!inner(created_at)")
        .eq("lesson_stars.user_id", session.user.id),
      search,
      options.subject,
    );

    if (options.sort === "mostStarred") {
      query = query.order("star_count", { ascending: false });
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw error;
    return data;
  }

  let query = supabase.from("lessons").select("*");

  if (options.tab === "public") {
    query = query.eq("visibility", "public");
  } else {
    const session = await getSession();
    if (!session) throw new Error("Not signed in.");
    query = query.eq("owner_id", session.user.id);
  }

  query = applyLessonFilters(query, search, options.subject);

  if (options.sort === "mostStarred") {
    query = query.order("star_count", { ascending: false });
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });
  if (error) throw error;
  return data;
}

// Admin panel's Lessons tab: every Lesson platform-wide, regardless of
// ownership or Visibility. No client-side admin check — RLS itself is what
// makes this actually return everything only for an Admin caller
// (lessons_select_public_own_or_admin already grants that); a non-admin
// calling this just gets the same public+own subset getLessons() would.
// `search` matches a case-insensitive substring of either title or subject.
export async function getAllLessons(search?: string): Promise<Lesson[]> {
  let query = supabase.from("lessons").select();

  const term = search?.trim();
  if (term) {
    // Strips `,` and `(`/`)` — structurally meaningful in a raw PostgREST
    // `.or()` filter string (comma separates conditions, parens group them)
    // — and `%`, the ILIKE wildcard, so search text can't inject unintended
    // filter grouping or wildcard behavior.
    const escaped = term.replace(/[%,()]/g, "");
    query = query.or(`title.ilike.%${escaped}%,subject.ilike.%${escaped}%`);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });
  if (error) throw error;
  return data;
}

export type SubjectSummary = {
  subject: string;
  lessonCount: number;
};

// Backs Home's "Browse by subject" cards — one normalized Subject group per
// row, scoped to Public Lessons plus the caller's own (spec's data-scoping
// decision, story 38), alphabetically sorted already by the RPC. `subject`
// is a representative original-casing label for display (the group's most
// recently created Lesson's literal Subject text), not a normalized value —
// case/whitespace collapsing only ever happens inside the RPC (see the
// 20260821110000_subject_browsing migration's normalize_subject helper),
// never here.
export async function getSubjectSummaries(): Promise<SubjectSummary[]> {
  const { data, error } = await supabase.rpc("get_subject_summaries");
  if (error) throw error;
  return (data as { subject: string; lesson_count: number }[]).map((row) => ({
    subject: row.subject,
    lessonCount: row.lesson_count,
  }));
}

// Backs the Subject page (`/subject/:name`): same Public+own visibility
// scope as getSubjectSummaries above (the Hub's combined view), matched
// against `name` normalized the same way, newest-first. An unrecognized or
// empty Subject just matches zero rows — the caller renders that as an
// empty state rather than treating it as an error (spec story 15).
export async function getLessonsForSubject(name: string): Promise<Lesson[]> {
  const { data, error } = await supabase.rpc("get_lessons_for_subject", {
    p_subject: name,
  });
  if (error) throw error;
  return data as Lesson[];
}

export async function getLesson(id: string): Promise<Lesson> {
  const { data, error } = await supabase
    .from("lessons")
    .select()
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// Re-validates with the same rule set createLesson uses (validateLessonFields)
// — Manage lets the owner edit every Lesson field, not just Title and
// Visibility, so the same required-field/Origin-default rules apply here too.
// RLS restricts which row this can actually touch to the owner or an Admin;
// when it can't, 0 rows match and .single() surfaces that as a thrown error.
export async function updateLesson(
  id: string,
  updates: LessonFieldsInput,
): Promise<Lesson> {
  const fields = validateLessonFields(updates);
  const { data, error } = await supabase
    .from("lessons")
    .update({ ...fields, visibility: updates.visibility })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Same RLS-enforced ownership rule as updateLesson: 0 rows deleted (not the
// owner or an Admin) surfaces as a thrown error via .single().
export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase
    .from("lessons")
    .delete()
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
}

// A JSONB column overwrite, not an append — publishing a new Test fully
// replaces any prior one (spec's replace-not-append data-model decision).
// Same RLS-enforced ownership rule as updateLesson/deleteLesson: a non-owner
// matches 0 rows and .single() surfaces that as a thrown error.
export async function publishTest(
  lessonId: string,
  questions: unknown,
): Promise<Lesson> {
  const validated = validateTestFields(questions);
  const { data, error } = await supabase
    .from("lessons")
    .update({ test: validated })
    .eq("id", lessonId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Resolves display names for Lesson attribution ("By {name}") — id -> name
// only, via a narrow security-definer RPC (see the
// 20260815180806_lesson_owner_names migration for why this can't just be a
// profiles RLS read).
export async function getOwnerNames(
  ownerIds: string[],
): Promise<Record<string, string>> {
  if (ownerIds.length === 0) return {};
  const { data, error } = await supabase.rpc("get_profile_names", {
    ids: ownerIds,
  });
  if (error) throw error;
  return Object.fromEntries(
    (data as { id: string; name: string }[]).map((row) => [row.id, row.name]),
  );
}

// Which of the given Lessons the signed-in caller has starred — batch
// lookup alongside a Lesson list, same shape as getOwnerNames. RLS already
// scopes lesson_stars selects to the caller's own rows, so this is a plain
// filtered query, not an RPC. Signed-out callers see no starred Lessons.
export async function getMyStarredLessonIds(
  lessonIds: string[],
): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();
  const session = await getSession();
  if (!session) return new Set();
  const { data, error } = await supabase
    .from("lesson_stars")
    .select("lesson_id")
    .eq("user_id", session.user.id)
    .in("lesson_id", lessonIds);
  if (error) throw error;
  return new Set(data.map((row) => row.lesson_id));
}

// The shape toggle_lesson_star's SQL `returns table (starred boolean,
// star_count integer)` produces — named once so the RPC's result cast and
// this function's return type don't each re-derive the same pair.
export type StarState = { starred: boolean; star_count: number };

// Toggles the caller's Star on a Lesson: removes it if present, adds it if
// not, one per (Account, Lesson) (unique constraint). A single RPC rather
// than a client-orchestrated check-then-act — see the
// 20260820190000_lesson_stars migration's toggle_lesson_star for why this
// is still RLS-enforced (not a security-definer bypass) and only exists for
// atomicity. Throws if the caller can't see the Lesson (RLS rejects the
// insert) or isn't signed in.
export async function toggleLessonStar(lessonId: string): Promise<StarState> {
  const { data, error } = await supabase
    .rpc("toggle_lesson_star", { p_lesson_id: lessonId })
    .single();
  if (error) throw error;
  return data as StarState;
}

export type LessonNote = {
  id: string;
  lesson_id: string;
  user_id: string;
  content: string;
  updated_at: string;
};

// The caller's own Note on a Lesson, or null if they haven't taken one —
// null is a normal result here (unlike most `.single()` calls elsewhere in
// this file, where 0 rows means "not allowed"), so this uses
// `.maybeSingle()` instead. Signed-out callers get null rather than a
// thrown "not signed in" error, same as getMyStarredLessonIds.
export async function getMyNote(lessonId: string): Promise<LessonNote | null> {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("lesson_notes")
    .select()
    .eq("lesson_id", lessonId)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Upserts the caller's one Note for this Lesson on non-empty text, or
// deletes the row entirely when `text` trims to empty (spec: clearing a
// Note removes it rather than leaving an empty row behind — there is no
// check constraint blocking an empty `content`, this is the only path that
// enforces non-empty). `updated_at` is set explicitly rather than relying
// on the column default, since a default only fires on insert — the
// upsert's conflict branch needs the same bump. RLS restricts both the
// upsert and the delete to the caller's own row
// (lesson_notes_update_own/lesson_notes_delete_own); the insert branch
// additionally requires the caller be able to view the Lesson itself
// (lesson_notes_insert_own_visible_lesson).
export async function saveNote(lessonId: string, text: string): Promise<LessonNote | null> {
  const trimmed = text.trim();
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");

  if (!trimmed) {
    const { error } = await supabase
      .from("lesson_notes")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("user_id", session.user.id);
    if (error) throw error;
    return null;
  }

  const { data, error } = await supabase
    .from("lesson_notes")
    .upsert(
      {
        lesson_id: lessonId,
        user_id: session.user.id,
        content: trimmed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lesson_id,user_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type MyNote = {
  id: string;
  lesson_id: string;
  content: string;
  updated_at: string;
  lesson_title: string;
  lesson_subject: string;
};

// Backs the "My Notes" tab (ticket 04) — the caller's own Notes, most
// recently updated first, joined with each Note's parent Lesson title/
// Subject. `lessons!inner(...)` (rather than a plain embed) is the whole
// mechanism behind "a Note whose Lesson is no longer visible silently drops
// out": lesson_notes_select_own has no visibility check at all (a Note stays
// selectable even once its Lesson turns Private under someone else), but the
// embedded `lessons` side of the join is still subject to lessons' own RLS,
// and `!inner` turns a denied/absent embed into a dropped row instead of one
// with a null `lessons` — same technique getLessons's starred tab uses via
// `lesson_stars!inner`, just from the other table. A deleted Lesson never
// reaches this point at all: lesson_notes.lesson_id cascades on delete, so
// the Note row itself is gone before any query runs.
export async function getMyNotes(): Promise<MyNote[]> {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from("lesson_notes")
    .select("id, lesson_id, content, updated_at, lessons!inner(title, subject)")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  // Without generated Database types (this project has none — see
  // supabaseClient.ts), postgrest-js can't confirm the lessons/lesson_notes
  // relation is to-one and statically types the embedded `lessons` as an
  // array — but the FK means it's always exactly one object at runtime, so
  // a direct `as` (which TS rejects here as a non-overlapping type) would be
  // wrong to "fix" by matching the array type instead.
  return (data as unknown as (Pick<LessonNote, "id" | "lesson_id" | "content" | "updated_at"> & {
    lessons: { title: string; subject: string };
  })[]).map((row) => ({
    id: row.id,
    lesson_id: row.lesson_id,
    content: row.content,
    updated_at: row.updated_at,
    lesson_title: row.lessons.title,
    lesson_subject: row.lessons.subject,
  }));
}

export type LessonComment = {
  id: string;
  lesson_id: string;
  author_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

export type LessonReply = {
  id: string;
  comment_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

// getLessonComments' actual return shape — a Comment with its Replies
// nested inline. Kept distinct from LessonComment itself (rather than
// adding `replies` to that type directly) because createComment/
// updateComment/deleteComment return a bare lesson_comments row with no
// `replies` key at all; a UI merging one of those into already-fetched
// state needs to preserve the existing `replies` array, which only works
// cleanly if the two types stay separate.
export type CommentWithReplies = LessonComment & { replies: LessonReply[] };

// Newest-first per spec, each Comment's Replies nested inline oldest-first.
// Soft-deleted Comments are returned too (deleted_at set, body left
// intact) rather than filtered out — the Lesson detail page renders those
// as a "[deleted]" tombstone in place, so a Comment's position/row (and
// its Replies) never disappears (ADR 0008). RLS scopes both queries to
// rows on a Lesson the caller can already view
// (lesson_comments_select_visible_lesson /
// lesson_comment_replies_select_visible_lesson).
export async function getLessonComments(lessonId: string): Promise<CommentWithReplies[]> {
  const { data: comments, error } = await supabase
    .from("lesson_comments")
    .select()
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (comments.length === 0) return [];

  const { data: replies, error: repliesError } = await supabase
    .from("lesson_comment_replies")
    .select()
    .in(
      "comment_id",
      comments.map((c) => c.id),
    )
    .order("created_at", { ascending: true });
  if (repliesError) throw repliesError;

  const repliesByComment = new Map<string, LessonReply[]>();
  for (const reply of replies as LessonReply[]) {
    const forComment = repliesByComment.get(reply.comment_id) ?? [];
    forComment.push(reply);
    repliesByComment.set(reply.comment_id, forComment);
  }

  return (comments as LessonComment[]).map((comment) => ({
    ...comment,
    replies: repliesByComment.get(comment.id) ?? [],
  }));
}

// RLS additionally requires the caller be able to view the Lesson itself
// (lesson_comments_insert_own_visible_lesson) — a Student can't comment on
// a private Lesson they don't own, even by guessing its id.
export async function createComment(
  lessonId: string,
  body: string,
): Promise<LessonComment> {
  const validated = validateCommentBody(body);
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("lesson_comments")
    .insert({ lesson_id: lessonId, author_id: session.user.id, body: validated })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Author-only — RLS plus the lesson_comments migration's
// enforce_comment_update_rules trigger reject an Admin editing someone
// else's body (Admin gets delete only, never edit, per ADR 0008/spec). A
// non-author's attempt matches 0 rows and .single() surfaces that as a
// thrown error, same pattern as updateLesson.
export async function updateComment(id: string, body: string): Promise<LessonComment> {
  const validated = validateCommentBody(body);
  const { data, error } = await supabase
    .from("lesson_comments")
    .update({ body: validated })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Soft-delete: sets deleted_at rather than removing the row, so any Replies
// underneath (ticket 05) aren't orphaned by a hard delete or cascade — see
// ADR 0008. Allowed for the author or an Admin (RLS); a non-author,
// non-Admin caller matches 0 rows and .single() surfaces that as a thrown
// error. The original body is left in place, not blanked — the "[deleted]"
// tombstone is a render-time UI decision keyed on deleted_at, not a
// data-erasure one. Returns the updated row (like updateComment) rather
// than void, so the caller reflects the server's actual deleted_at instead
// of stamping its own.
export async function deleteComment(id: string): Promise<LessonComment> {
  const { data, error } = await supabase
    .from("lesson_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// RLS requires the caller be able to view the parent Comment's Lesson
// (lesson_comment_replies_insert_own_visible_lesson) — same shape as
// createComment, one join further out. Structurally, `comment_id` can only
// ever reference a row in lesson_comments, never in
// lesson_comment_replies itself — see ADR 0006 — so there is no code path
// here that could target a Reply-of-a-Reply even if a caller tried.
export async function createReply(commentId: string, body: string): Promise<LessonReply> {
  const validated = validateCommentBody(body);
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("lesson_comment_replies")
    .insert({ comment_id: commentId, author_id: session.user.id, body: validated })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Author-only, with no Admin exception at all — unlike updateComment, RLS
// itself (lesson_comment_replies_update_own) never grants an Admin UPDATE
// access here, since Replies never soft-delete via update in the first
// place. A non-author's attempt matches 0 rows and .single() surfaces that
// as a thrown error, same pattern as updateComment.
export async function updateReply(id: string, body: string): Promise<LessonReply> {
  const validated = validateCommentBody(body);
  const { data, error } = await supabase
    .from("lesson_comment_replies")
    .update({ body: validated })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// A real DELETE, not a soft-delete — Replies have no children to protect,
// so there's no tombstone to preserve (ADR 0008). Allowed for the author
// or an Admin (RLS); a non-author, non-Admin caller matches 0 rows and
// .single() surfaces that as a thrown error.
export async function deleteReply(id: string): Promise<void> {
  const { error } = await supabase
    .from("lesson_comment_replies")
    .delete()
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
}

export type AccountStatus = "active" | "invited";

export type Account = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
};

// Admin-only — the RPC itself rejects a non-Admin caller (see the
// admin_list_accounts migration), this just surfaces that as a thrown error.
export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.rpc("admin_list_accounts");
  if (error) throw error;
  return data;
}

// A plain RLS-gated table update, not the Edge Function — spec.md: role
// changes on existing Accounts don't need the Auth Admin API. RLS plus the
// ticket 01 trigger reject a non-Admin caller, an Admin acting on their own
// row, or removing the last remaining Admin's role.
export async function updateAccountRole(id: string, role: Role): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  // Without an explicit redirectTo, Supabase falls back to the project's
  // Auth "Site URL" setting — sends people to whatever that's set to
  // (e.g. localhost) regardless of which deployment they reset from.
  // window.location.origin is always the environment actually in use.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

// Both actions below call the single privileged Edge Function (ADR 0002) —
// the only place the service_role key exists. Supabase's FunctionsHttpError
// carries the function's JSON error body on `.context`, not `.message`, so
// this unwraps it to surface the Edge Function's actual error text.
async function invokeAdminAccountsFunction(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("admin-accounts", {
    body,
  });
  if (error) {
    if ("context" in error && error.context instanceof Response) {
      const parsed = await error.context.clone().json().catch(() => null);
      if (parsed?.error) throw new Error(parsed.error);
    }
    throw error;
  }
  return data;
}

// No invite email — ADR 0005. The Admin sets the password directly; the
// new Account is immediately usable with it. Re-validates name/email/
// password with the same registerValidation.ts rule Registration uses
// (spec's "one rule set" decision) before ever reaching the Edge Function.
export async function createAccount(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<Account> {
  const fields = validateRegisterFields(input);
  const data = await invokeAdminAccountsFunction({
    action: "create",
    name: fields.name,
    email: fields.email,
    password: fields.password,
    role: input.role,
  });
  return data as Account;
}

export async function deleteAccount(id: string): Promise<void> {
  await invokeAdminAccountsFunction({ action: "delete", id });
}

export type HelpTutorial = {
  content: string;
};

// The Tutorial is a singleton row (spec's data-model decision) — id is
// always 1, seeded by the help_tutorial migration, so this never 0-rows.
export async function getHelpTutorial(): Promise<HelpTutorial> {
  const { data, error } = await supabase
    .from("help_tutorial")
    .select("content")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}

// RLS restricts this to an Admin caller; a non-Admin matches 0 rows and
// .single() surfaces that as a thrown error, same pattern as updateLesson.
export async function updateHelpTutorial(content: string): Promise<HelpTutorial> {
  const { data, error } = await supabase
    .from("help_tutorial")
    .update({ content })
    .eq("id", 1)
    .select("content")
    .single();
  if (error) throw error;
  return data;
}

export type ChangelogEntry = {
  id: string;
  version: string;
  entry_date: string;
  body: string;
  created_at: string;
};

export type ChangelogEntryFields = {
  version: string;
  entry_date: string;
  body: string;
};

// Readable by any signed-in Account (RLS); newest-first by the Admin-set
// entry_date, per the spec's display-order decision. created_at descending
// is a tie-break for entries sharing the same entry_date — entry_date alone
// has no deterministic order between ties.
export async function getChangelogEntries(): Promise<ChangelogEntry[]> {
  const { data, error } = await supabase
    .from("changelog_entries")
    .select()
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// RLS restricts insert to an Admin caller; a non-Admin's insert is rejected
// directly by the with-check clause, surfaced as a thrown error.
export async function createChangelogEntry(
  fields: ChangelogEntryFields,
): Promise<ChangelogEntry> {
  const { data, error } = await supabase
    .from("changelog_entries")
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Same RLS-enforced Admin-only rule as createChangelogEntry: a non-Admin
// caller matches 0 rows and .single() surfaces that as a thrown error, same
// pattern as updateLesson.
export async function updateChangelogEntry(
  id: string,
  fields: ChangelogEntryFields,
): Promise<ChangelogEntry> {
  const { data, error } = await supabase
    .from("changelog_entries")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Same RLS-enforced Admin-only rule, surfaced the same way as deleteLesson.
export async function deleteChangelogEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("changelog_entries")
    .delete()
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
}

