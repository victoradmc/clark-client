import { useState, type FormEvent } from "react";
import { login } from "../data/clarkApi";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,#FDEDE7_0%,#FAFAF9_45%)] p-6">
      <div className="w-[380px] rounded-[20px] border border-[#EEEEEC] bg-white p-9 shadow-[0_1px_2px_rgba(16,24,32,.04),0_20px_40px_rgba(16,24,32,.08)]">
        <div className="mb-7 flex items-center gap-2">
          <div className="h-7 w-7 rounded-[9px] bg-[#E8542A]" />
          <span className="text-[16px] font-bold tracking-[-0.01em]">
            Clark
          </span>
        </div>
        <h1 className="mb-1.5 text-[26px] font-extrabold tracking-[-0.02em]">
          Welcome back
        </h1>
        <p className="mb-6 text-[13px] text-[#8A8D93]">
          Sign in with your Clark account.
        </p>
        <form className="grid gap-3.5" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-[12.5px] font-semibold text-[#4B4E56]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-[11px] border border-[#E4E4E1] bg-[#FBFBFA] px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-[#E8542A] focus:outline-offset-1"
              placeholder="you@student.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-[12.5px] font-semibold text-[#4B4E56]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-[11px] border border-[#E4E4E1] bg-[#FBFBFA] px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-[#E8542A] focus:outline-offset-1"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-[13px] text-[#C7431F]">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1.5 w-full rounded-[11px] bg-[#E8542A] py-3 text-[14.5px] font-bold text-white shadow-[0_8px_20px_rgba(232,84,42,.28)] disabled:opacity-60"
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
