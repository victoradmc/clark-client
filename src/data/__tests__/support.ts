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
    // listUsers defaults to 50 users per page — the fixture pool across all
    // test files has grown past that, so the default call can silently miss
    // an existing account and fall through to throwing createError below.
    // perPage is set well above the current fixture count instead of paging.
    const { data: list, error: listError } =
      await serviceRoleClient.auth.admin.listUsers({ perPage: 1000 });
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

const MAILPIT_URL = "http://127.0.0.1:54324";

// Polls the local Supabase stack's captured-email inbox (Mailpit) for a
// message to `email` — the only way to observe "did this trigger a real
// Auth email" without mocking supabase.auth itself.
export async function findEmailTo(
  email: string,
  { timeoutMs = 3000 }: { timeoutMs?: number } = {},
): Promise<{ subject: string } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const body = await res.json();
    if (body.messages?.length > 0) {
      return { subject: body.messages[0].Subject };
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}
