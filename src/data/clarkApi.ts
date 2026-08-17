import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
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

