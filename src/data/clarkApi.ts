import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { validateLessonFields } from "./lessonValidation";
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
};

export type Role = "student" | "admin";

export type Profile = {
  id: string;
  name: string;
  email: string;
  bio: string;
  role: Role;
};

export async function login(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
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

export async function createLesson(input: {
  title: unknown;
  content: unknown;
  subject: unknown;
  origin?: unknown;
  visibility: LessonVisibility;
}): Promise<Lesson> {
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

export type HubTab = "public" | "mine";

// Public tab: every Lesson with visibility = public, regardless of owner.
// Mine tab: every Lesson owned by the caller, regardless of visibility.
// `search` matches title, case-insensitive substring. `subject`, when given
// and not "All subjects", narrows to an exact Subject match.
export async function getLessons(options: {
  tab: HubTab;
  search?: string;
  subject?: string;
}): Promise<Lesson[]> {
  let query = supabase.from("lessons").select();

  if (options.tab === "public") {
    query = query.eq("visibility", "public");
  } else {
    const session = await getSession();
    if (!session) throw new Error("Not signed in.");
    query = query.eq("owner_id", session.user.id);
  }

  const search = options.search?.trim();
  if (search) {
    query = query.ilike("title", `%${search}%`);
  }

  if (options.subject && options.subject !== "All subjects") {
    query = query.eq("subject", options.subject);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });
  if (error) throw error;
  return data;
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

// Owner-editable fields only — content, subject, and origin are immutable
// post-publish (spec's content-editing-scope decision). RLS restricts which
// row this can actually touch to the owner or an Admin; when it can't, 0
// rows match and .single() surfaces that as a thrown error.
export async function updateLesson(
  id: string,
  updates: { title: string; visibility: LessonVisibility },
): Promise<Lesson> {
  const { data, error } = await supabase
    .from("lessons")
    .update(updates)
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
