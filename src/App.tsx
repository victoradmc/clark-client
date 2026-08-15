import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import type { Role, Session } from "./data/clarkApi";
import { getProfile, onSessionChange } from "./data/clarkApi";
import LoginScreen from "./screens/LoginScreen";
import AppShell from "./screens/AppShell";
import HubScreen from "./screens/HubScreen";
import UploadLessonScreen from "./screens/UploadLessonScreen";
import UploadTestScreen from "./screens/UploadTestScreen";
import LessonViewScreen from "./screens/LessonViewScreen";
import ManageLessonScreen from "./screens/ManageLessonScreen";
import TakeTestScreen from "./screens/TakeTestScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AdminScreen from "./screens/AdminScreen";

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

  // Drives only the Admin nav link's visibility — a UI convenience, not a
  // security boundary. AdminScreen and every admin-only clarkApi call are
  // independently guarded server-side (RLS, the admin_list_accounts RPC's
  // own check, and the Edge Function's caller-role check).
  useEffect(() => {
    if (!session) {
      setRole(null);
      return;
    }
    let cancelled = false;
    getProfile()
      .then((profile) => {
        if (!cancelled) setRole(profile.role);
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
        <Route path="/upload" element={<UploadLessonScreen />} />
        <Route path="/upload-test" element={<UploadTestScreen />} />
        <Route path="/lessons/:id" element={<LessonViewScreen />} />
        <Route path="/lessons/:id/manage" element={<ManageLessonScreen />} />
        <Route path="/lessons/:id/test" element={<TakeTestScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/admin" element={<AdminScreen />} />
      </Routes>
    </AppShell>
  );
}
