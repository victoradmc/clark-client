import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import type { Role, Session } from "./data/clarkApi";
import { getProfile, onSessionChange } from "./data/clarkApi";
import i18n, { DEFAULT_LOCALE } from "./i18n";
import LoginScreen from "./screens/LoginScreen";
import AppShell from "./screens/AppShell";
import HubScreen from "./screens/HubScreen";
import LibraryScreen from "./screens/LibraryScreen";
import UploadLessonScreen from "./screens/UploadLessonScreen";
import UploadTestScreen from "./screens/UploadTestScreen";
import LessonViewScreen from "./screens/LessonViewScreen";
import ManageLessonScreen from "./screens/ManageLessonScreen";
import TakeTestScreen from "./screens/TakeTestScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AdminScreen from "./screens/AdminScreen";
import HelpScreen from "./screens/HelpScreen";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    return onSessionChange((next) => {
      setSession(next);
      setLoading(false);
    });
  }, []);

  // Drives the Admin nav link's visibility (a UI convenience, not a security
  // boundary — every admin-only clarkApi call is independently guarded
  // server-side) and the UI language — never browser-detected, always the
  // signed-in Account's saved preference, reset to the default once signed
  // out so a previous Account's language doesn't leak into the login screen.
  useEffect(() => {
    if (!session) {
      setRole(null);
      void i18n.changeLanguage(DEFAULT_LOCALE);
      return;
    }
    let cancelled = false;
    getProfile()
      .then((profile) => {
        if (cancelled) return;
        setRole(profile.role);
        void i18n.changeLanguage(profile.locale);
      })
      .catch(() => {
        if (!cancelled) setRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) return null;
  if (!session) return <LoginScreen />;

  return (
    <AppShell session={session} isAdmin={role === "admin"}>
      <Routes>
        <Route path="/" element={<HubScreen />} />
        <Route path="/library" element={<LibraryScreen />} />
        <Route path="/upload" element={<UploadLessonScreen />} />
        <Route path="/upload-test" element={<UploadTestScreen />} />
        <Route path="/lessons/:id" element={<LessonViewScreen />} />
        <Route path="/lessons/:id/manage" element={<ManageLessonScreen />} />
        <Route path="/lessons/:id/test" element={<TakeTestScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/help" element={<HelpScreen />} />
        <Route path="/admin" element={<AdminScreen />} />
      </Routes>
    </AppShell>
  );
}
