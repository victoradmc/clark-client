// The privileged Edge Function (ADR 0002, ticket 07): the only place the
// `service_role` key exists, and the only way to create or delete an
// Account directly. Exposes exactly two actions, matching ADR 0002's "not a
// general-purpose backend" scope.
//
// Role changes on *existing* Accounts deliberately do NOT go through here —
// spec.md: "a plain RLS-gated `profiles` table update an Admin can perform
// directly from the client." Only account creation and delete need the
// Auth Admin API.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Duplicated from src/data/registerValidation.ts's MIN_PASSWORD_LENGTH,
// not imported: this Edge Function is a separate Deno deploy unit, and the
// local edge runtime can't resolve a relative import reaching outside
// supabase/functions/ at all (confirmed — it 503s with "Module not found"
// on boot). Keep this number in sync with registerValidation.ts by hand.
const MIN_PASSWORD_LENGTH = 8;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

  // Identifies the caller from their own session JWT — never trusted from
  // the request body, so a caller can't claim to be someone else.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();
  if (callerError || !caller) return json({ error: "Not signed in." }, 401);

  // service_role from here on — bypasses RLS entirely, so every check the
  // rest of this function makes is load-bearing.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single();
  if (callerProfile?.role !== "admin") {
    return json({ error: "Admin Role required." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  if (body.action === "create") {
    const { name, email, password, role } = body;
    const missing: string[] = [];
    if (typeof name !== "string" || !name.trim()) missing.push("name");
    if (typeof email !== "string" || !email.trim()) missing.push("email");
    if (typeof password !== "string" || !password) missing.push("password");
    if (role !== "student" && role !== "admin") missing.push("a valid role ('student' or 'admin')");
    if (missing.length > 0) {
      return json({ error: `Expected ${missing.join(", ")}.` }, 400);
    }
    // Same rule as Registration (registerValidation.ts's MIN_PASSWORD_LENGTH,
    // spec's "one rule set" decision) — re-checked here as defense in depth
    // on top of the Admin Accounts form's own pre-submit check. Checked
    // separately from the presence check above so a too-short (but present)
    // password gets its own specific length message.
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        400,
      );
    }

    // email_confirm: true means this Account is immediately usable with the
    // password the Admin chose — no invite email, no confirmation step
    // (ADR 0005; the email-quota reason this replaced inviteUserByEmail).
    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
    if (createError || !created.user) {
      return json({ error: createError?.message ?? "Could not create this Account." }, 400);
    }

    // upsert, not insert: the on_auth_user_created trigger (ticket 01,
    // ADR 0004) already created a default profiles row (name '', role
    // 'student') the moment createUser() inserted into auth.users — this
    // overwrites it with the Admin's chosen name/role instead of colliding
    // with it on the primary key.
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: created.user.id,
      name,
      email,
      role,
    });
    if (profileError) {
      return json({ error: profileError.message }, 400);
    }

    return json({ id: created.user.id, name, email, role, status: "invited" });
  }

  if (body.action === "delete") {
    const { id } = body;
    if (typeof id !== "string" || !id) {
      return json({ error: "Expected an Account id." }, 400);
    }
    // The DB trigger's self-action check is exempted for service_role calls
    // (it can't tell which Admin is behind an Admin API call) — this check
    // is the only place "an Admin can't delete their own Account" is
    // actually enforced for this path. The last-remaining-admin check has
    // no such exemption, so that one still fires from deleteUser() below.
    if (id === caller.id) {
      return json({ error: "You cannot delete your own Account." }, 400);
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(id);
    if (deleteError) {
      return json({ error: deleteError.message }, 400);
    }

    return json({ id });
  }

  return json({ error: "Unknown action." }, 400);
});
