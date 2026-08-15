import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import type { Session } from "./data/clarkApi";
import { onSessionChange } from "./data/clarkApi";
import LoginScreen from "./screens/LoginScreen";
import AppShell from "./screens/AppShell";
import HubPlaceholderScreen from "./screens/HubPlaceholderScreen";
import UploadLessonScreen from "./screens/UploadLessonScreen";
import LessonViewScreen from "./screens/LessonViewScreen";

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
        <Route path="/" element={<HubPlaceholderScreen />} />
        <Route path="/upload" element={<UploadLessonScreen />} />
        <Route path="/lessons/:id" element={<LessonViewScreen />} />
      </Routes>
    </AppShell>
  );
}
