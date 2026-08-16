import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getProfile } from "../data/clarkApi";
import TabToggle from "../components/TabToggle";
import AdminAccountsTab from "./AdminAccountsTab";
import AdminLessonsTab from "./AdminLessonsTab";

type AdminTab = "accounts" | "lessons";

export default function AdminScreen() {
  const { t } = useTranslation();
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
    return <p className="text-muted text-sm">{t("common.loading")}</p>;
  }

  if (!authorized) {
    return <p className="text-brand-dark text-sm">{t("admin.notAllowed")}</p>;
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
            {t("admin.eyebrow")}
          </div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">
            {t("admin.title")}
          </h1>
        </div>
        <TabToggle
          options={[
            { value: "accounts", label: t("admin.tabAccounts") },
            { value: "lessons", label: t("admin.tabLessons") },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "accounts" ? <AdminAccountsTab /> : <AdminLessonsTab />}
    </div>
  );
}
