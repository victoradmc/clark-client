import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { EmailAlreadyRegisteredError, login, register } from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";
import { MIN_PASSWORD_LENGTH } from "../data/registerValidation";

type Mode = "login" | "register";

export default function LoginScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

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

  function openRegisterForm() {
    setMode("register");
    setRegisterName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterConfirmPassword("");
    setRegisterError(null);
  }

  async function handleRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    setRegisterError(null);

    if (registerPassword.length < MIN_PASSWORD_LENGTH) {
      setRegisterError(t("login.passwordTooShort", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setRegisterError(t("login.passwordMismatch"));
      return;
    }

    setRegistering(true);
    try {
      await register({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
      });
      // No further action: signUp() already leaves the caller signed in,
      // and App's onSessionChange listener swaps this screen out on its own.
    } catch (err) {
      // Deliberately breaks from friendlyErrorMessage's usual "never branch
      // on error identity" rule (see errorMessage.ts) — the spec calls for
      // a specific duplicate-email message, not a generic one, so this is
      // the one place in the app that inspects an error's type to decide
      // what to show.
      setRegisterError(
        err instanceof EmailAlreadyRegisteredError
          ? t("login.emailAlreadyRegistered")
          : friendlyErrorMessage(err, t("login.couldNotRegister")),
      );
    } finally {
      setRegistering(false);
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
              onClick={openRegisterForm}
              className="mt-4 w-full text-center text-[12.5px] font-semibold text-[#8A8D93] hover:underline"
            >
              {t("login.registerLink")}
            </button>
          </>
        )}

        {mode === "register" && (
          <>
            <h1 className="mb-1.5 text-[26px] font-extrabold tracking-[-0.02em]">
              {t("login.registerTitle")}
            </h1>
            <p className="mb-6 text-[13px] text-[#8A8D93]">
              {t("login.registerSubtitle")}
            </p>
            <form className="grid gap-3.5" onSubmit={handleRegisterSubmit}>
              <div>
                <label
                  htmlFor="register-name"
                  className="mb-1.5 block text-[12.5px] font-semibold text-[#4B4E56]"
                >
                  {t("login.nameLabel")}
                </label>
                <input
                  id="register-name"
                  type="text"
                  required
                  autoComplete="name"
                  className="w-full rounded-[11px] border border-[#E4E4E1] bg-[#FBFBFA] px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-[#E8542A] focus:outline-offset-1"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="register-email"
                  className="mb-1.5 block text-[12.5px] font-semibold text-[#4B4E56]"
                >
                  {t("login.email")}
                </label>
                <input
                  id="register-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-[11px] border border-[#E4E4E1] bg-[#FBFBFA] px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-[#E8542A] focus:outline-offset-1"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="register-password"
                  className="mb-1.5 block text-[12.5px] font-semibold text-[#4B4E56]"
                >
                  {t("login.password")}
                </label>
                <input
                  id="register-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="w-full rounded-[11px] border border-[#E4E4E1] bg-[#FBFBFA] px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-[#E8542A] focus:outline-offset-1"
                  placeholder="••••••••"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="register-confirm-password"
                  className="mb-1.5 block text-[12.5px] font-semibold text-[#4B4E56]"
                >
                  {t("login.confirmPasswordLabel")}
                </label>
                <input
                  id="register-confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="w-full rounded-[11px] border border-[#E4E4E1] bg-[#FBFBFA] px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-[#E8542A] focus:outline-offset-1"
                  placeholder="••••••••"
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                />
              </div>
              {registerError && (
                <p className="text-[13px] text-[#C7431F]">{registerError}</p>
              )}
              <button
                type="submit"
                disabled={registering}
                className="mt-1.5 w-full rounded-[11px] bg-[#E8542A] py-3 text-[14.5px] font-bold text-white shadow-[0_8px_20px_rgba(232,84,42,.28)] disabled:opacity-60"
              >
                {registering ? t("login.registering") : t("login.registerButton")}
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
      </div>
    </div>
  );
}
