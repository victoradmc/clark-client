import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import type { Session } from "./data/clarkApi";
import { onSessionChange } from "./data/clarkApi";
import LoginScreen from "./screens/LoginScreen";
import AppShell from "./screens/AppShell";
import HubScreen from "./screens/HubScreen";
import UploadLessonScreen from "./screens/UploadLessonScreen";
import UploadTestScreen from "./screens/UploadTestScreen";
import LessonViewScreen from "./screens/LessonViewScreen";
import ManageLessonScreen from "./screens/ManageLessonScreen";
import TakeTestScreen from "./screens/TakeTestScreen";
import ProfileScreen from "./screens/ProfileScreen";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSessionChange((next) => {
      setSession(next);
      setLoading(false);
    });
  }, []);

  if (loading) return null;
  if (!session) return <LoginScreen />;

  return (
    <AppShell session={session}>
      <Routes>
        <Route path="/" element={<HubScreen />} />
        <Route path="/upload" element={<UploadLessonScreen />} />
        <Route path="/upload-test" element={<UploadTestScreen />} />
        <Route path="/lessons/:id" element={<LessonViewScreen />} />
        <Route path="/lessons/:id/manage" element={<ManageLessonScreen />} />
        <Route path="/lessons/:id/test" element={<TakeTestScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
      </Routes>
    </AppShell>
  );
}
