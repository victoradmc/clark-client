import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { login, submitAccessRequest } from "../data/clarkApi";

type Mode = "login" | "request" | "requested";

// supabase-js's default (non-throwOnError) mode throws the raw parsed
// PostgREST error body — a plain `{ message, code, ... }` object, not an
// `Error` instance — so a bare `err instanceof Error` check (the pattern
// used elsewhere in this codebase) silently misses it. This form needs the
// duplicate-pending/existing-Account messages the check_access_request_
// eligibility trigger raises, so it reads `.message` off either shape.
function messageOf(err: unknown): string | undefined {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return undefined;
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      setError(t("login.incorrectCredentials"));
    } finally {
      setSubmitting(false);
    }
  }

  function openRequestForm() {
    setMode("request");
    setRequestName("");
    setRequestEmail("");
    setRequestMessage("");
    setRequestError(null);
  }

  async function handleRequestSubmit(e: FormEvent) {
    e.preventDefault();
    setRequestError(null);
    setRequesting(true);
    try {
      await submitAccessRequest({
        name: requestName,
        email: requestEmail,
        message: requestMessage.trim() || undefined,
      });
      setMode("requested");
    } catch (err) {
      setRequestError(messageOf(err) ?? t("login.couldNotSubmitRequest"));
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,#FDEDE7_0%,#FAFAF9_45%)] p-6">
      <div className="w-[380px] rounded-[20px] border border-[#EEEEEC] bg-white p-9 shadow-[0_1px_2px_rgba(16,24,32,.04),0_20px_40px_rgba(16,24,32,.08)]">
        <div className="mb-7 flex items-center gap-2">
          <div className="h-7 w-7 rounded-[9px] bg-[#E8542A]" />
          <span className="text-[16px] font-bold tracking-[-0.01em]">
            {t("nav.appName")}
          </span>
        </div>

        {mode === "login" && (
          <>
            <h1 className="mb-1.5 text-[26px] font-extrabold tracking-[-0.02em]">
              {t("login.welcomeBack")}
            </h1>
            <p className="mb-6 text-[13px] text-[#8A8D93]">{t("login.subtitle")}</p>
            <form className="grid gap-3.5" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[12.5px] font-semibold text-[#4B4E56]"
                >
                  {t("login.email")}
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
                  {t("login.password")}
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
                {submitting ? t("login.loggingIn") : t("login.logIn")}
              </button>
            </form>
            <button
              type="button"
              onClick={openRequestForm}
              className="mt-4 w-full text-center text-[12.5px] font-semibold text-[#8A8D93] hover:underline"
            >
              {t("login.requestAccess")}
            </button>
          </>
        )}

        {mode === "request" && (
          <>
            <h1 className="mb-1.5 text-[26px] font-extrabold tracking-[-0.02em]">
              {t("login.requestAccessTitle")}
            </h1>
            <p className="mb-6 text-[13px] text-[#8A8D93]">
              {t("login.requestAccessSubtitle")}
            </p>
            <form className="grid gap-3.5" onSubmit={handleRequestSubmit}>
              <div>
                <label
                  htmlFor="request-name"
                  className="mb-1.5 block text-[12.5px] font-semibold text-[#4B4E56]"
                >
                  {t("login.nameLabel")}
                </label>
                <input
                  id="request-name"
                  type="text"
                  required
                  className="w-full rounded-[11px] border border-[#E4E4E1] bg-[#FBFBFA] px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-[#E8542A] focus:outline-offset-1"
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="request-email"
                  className="mb-1.5 block text-[12.5px] font-semibold text-[#4B4E56]"
                >
                  {t("login.email")}
                </label>
                <input
                  id="request-email"
                  type="email"
                  required
                  className="w-full rounded-[11px] border border-[#E4E4E1] bg-[#FBFBFA] px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-[#E8542A] focus:outline-offset-1"
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="request-message"
                  className="mb-1.5 block text-[12.5px] font-semibold text-[#4B4E56]"
                >
                  {t("login.messageLabel")}
                </label>
                <textarea
                  id="request-message"
                  className="min-h-[70px] w-full rounded-[11px] border border-[#E4E4E1] bg-[#FBFBFA] px-3.5 py-2.5 text-sm leading-relaxed focus:outline-2 focus:outline-[#E8542A] focus:outline-offset-1"
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                />
              </div>
              {requestError && (
                <p className="text-[13px] text-[#C7431F]">{requestError}</p>
              )}
              <button
                type="submit"
                disabled={requesting}
                className="mt-1.5 w-full rounded-[11px] bg-[#E8542A] py-3 text-[14.5px] font-bold text-white shadow-[0_8px_20px_rgba(232,84,42,.28)] disabled:opacity-60"
              >
                {requesting ? t("login.submittingRequest") : t("login.submitRequest")}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="mt-4 w-full text-center text-[12.5px] font-semibold text-[#8A8D93] hover:underline"
            >
              {t("login.backToLogin")}
            </button>
          </>
        )}

        {mode === "requested" && (
          <>
            <h1 className="mb-1.5 text-[26px] font-extrabold tracking-[-0.02em]">
              {t("login.requestAccessTitle")}
            </h1>
            <p className="mb-6 text-[13px] text-[#4B4E56]">
              {t("login.requestSubmitted")}
            </p>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="w-full rounded-[11px] bg-[#E8542A] py-3 text-[14.5px] font-bold text-white shadow-[0_8px_20px_rgba(232,84,42,.28)]"
            >
              {t("login.backToLogin")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
