import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Test runs point the app's own Supabase client at the local dev stack
// (never the hosted project), per the spec's integration-testing decision.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    test: {
      environment: "node",
      // These are integration tests sharing one live local Supabase
      // instance (real Postgres, not mocks) — some assert on global state
      // (e.g. total admin count), so test files must not run concurrently.
      fileParallelism: false,
      env: {
        VITE_SUPABASE_URL: env.SUPABASE_LOCAL_URL,
        VITE_SUPABASE_ANON_KEY: env.SUPABASE_LOCAL_ANON_KEY,
        // Test-fixture setup only (e.g. creating fixture Accounts) — never
        // exposed to the app itself, which only ever reads the VITE_ vars.
        SUPABASE_LOCAL_URL: env.SUPABASE_LOCAL_URL,
        SUPABASE_LOCAL_SERVICE_ROLE_KEY: env.SUPABASE_LOCAL_SERVICE_ROLE_KEY,
      },
    },
  };
});
