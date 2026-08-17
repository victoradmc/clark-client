# Clark

Students upload AI-generated Markdown lessons and self-check tests, browse and read them later, and take the tests to reinforce what they learned. See `CONTEXT.md` for the domain glossary and `.scratch/clark-mvp/spec.md` for the full spec.

## Setup

Provisioning Supabase and Vercel involves several manual dashboard steps. Run the setup wizard instead of re-explaining them each time:

```
./scripts/setup-supabase.sh
```

It walks you through: installing the Supabase CLI and Docker, creating the hosted Supabase project, starting the local dev stack (used by the integration tests), linking the CLI, and wiring up Vercel environment variables. It's safe to re-run — it remembers values already saved in `.env` and skips what's already done.

## Development

```
npm install
npm run dev         # http://localhost:5173
npm run typecheck
npm test            # integration tests — needs `supabase start` running locally
npm run build
```

Tests run against a real local Postgres (`supabase start`), never mocks — `vite.config.ts` points the app's own Supabase client at `SUPABASE_LOCAL_URL`/`SUPABASE_LOCAL_ANON_KEY` (from `.env`) whenever `vitest` runs. After changing anything under `supabase/migrations/`, run `supabase db reset` to re-apply it locally before testing.

## Enabling self-service Registration

Registration (ADR 0004) and Admin-direct account creation (ADR 0005) both need two Auth settings flipped on the hosted Supabase project's dashboard — settings that live outside this repo's code, so they don't travel with a deploy. Run:

```
./scripts/enable-registration.sh
```

It walks you through turning on "Allow new users to sign up" and turning off "Confirm email" for the hosted project, then offers to verify both took effect with a live test signup against that project's Auth API. Safe to re-run.

## First Admin Account

Every other Account is created by an existing Admin inviting them in-app — but the very first one has to be created outside the app, since no Admin exists yet to send that invite. Run this once, against the hosted project:

```
node --env-file=.env scripts/seed-first-admin.ts --name "Your Name" --email you@example.com --password 'a-strong-password'
```
