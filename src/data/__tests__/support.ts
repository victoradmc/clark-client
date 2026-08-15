// Shared fixture helpers for integration tests that run against the real
// local Supabase instance (see vite.config.ts's `test.env`) — never mocks,
// per the spec's testing decisions.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_LOCAL_URL;
const serviceRoleKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_LOCAL_URL / SUPABASE_LOCAL_SERVICE_ROLE_KEY — is the " +
      "local Supabase stack running (`supabase start`) and .env populated?",
  );
}

// Bypasses RLS entirely — for seeding/inspecting fixtures directly, never
// for exercising the behavior under test.
export const serviceRoleClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const FIXTURE_PASSWORD = "TestPass123!";

// Creates the fixture Account if it doesn't already exist (idempotent
// across repeated runs against the persistent local DB), and (re)sets its
// profile to the given name/role. Returns the Account's id.
export async function ensureFixtureAccount(
  email: string,
  role: "student" | "admin",
  name: string,
): Promise<string> {
  const { data: created, error: createError } =
    await serviceRoleClient.auth.admin.createUser({
      email,
      password: FIXTURE_PASSWORD,
      email_confirm: true,
    });

  let id: string;
  if (createError) {
    const { data: list, error: listError } =
      await serviceRoleClient.auth.admin.listUsers();
    if (listError) throw listError;
    const existing = list.users.find((u) => u.email === email);
    if (!existing) throw createError;
    id = existing.id;
  } else {
    id = created.user.id;
  }

  const { error: upsertError } = await serviceRoleClient
    .from("profiles")
    .upsert({ id, name, email, role });
  if (upsertError) throw upsertError;

  return id;
}
