import { useState } from "react";
import { useTranslation } from "react-i18next";
import TabToggle from "../components/TabToggle";
import AdminTutorialEditor from "./AdminTutorialEditor";
import AdminChangelogEditor from "./AdminChangelogEditor";

type AdminHelpSubTab = "tutorial" | "changelog";

export default function AdminHelpTab() {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<AdminHelpSubTab>("tutorial");

  return (
    <div>
      <div className="mb-5">
        <TabToggle
          options={[
            { value: "tutorial", label: t("admin.help.tabTutorial") },
            { value: "changelog", label: t("admin.help.tabChangelog") },
          ]}
          value={subTab}
          onChange={setSubTab}
        />
      </div>

      {subTab === "tutorial" ? <AdminTutorialEditor /> : <AdminChangelogEditor />}
    </div>
  );
}
