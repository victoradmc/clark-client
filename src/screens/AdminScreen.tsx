import { useEffect, useState } from "react";
import { getProfile } from "../data/clarkApi";
import AdminAccountsTab from "./AdminAccountsTab";
import AdminLessonsTab from "./AdminLessonsTab";

type AdminTab = "accounts" | "lessons";

export default function AdminScreen() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<AdminTab>("accounts");

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((profile) => {
        if (!cancelled) setAuthorized(profile.role === "admin");
      })
      .catch(() => {
        if (!cancelled) setAuthorized(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (authorized === null) {
    return <p className="text-muted text-sm">Loading…</p>;
  }

  if (!authorized) {
    return (
      <p className="text-brand-dark text-sm">
        You don't have permission to view this page.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
            Admin
          </div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">
            Control panel
          </h1>
        </div>
        <div className="bg-chip flex gap-0.5 rounded-[11px] p-1">
          <button
            type="button"
            onClick={() => setTab("accounts")}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold ${
              tab === "accounts" ? "bg-white text-ink" : "text-muted"
            }`}
          >
            Accounts
          </button>
          <button
            type="button"
            onClick={() => setTab("lessons")}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold ${
              tab === "lessons" ? "bg-white text-ink" : "text-muted"
            }`}
          >
            Lessons
          </button>
        </div>
      </div>

      {tab === "accounts" ? <AdminAccountsTab /> : <AdminLessonsTab />}
    </div>
  );
}
