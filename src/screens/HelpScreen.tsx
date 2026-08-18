import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getChangelogEntries,
  getHelpTutorial,
  type ChangelogEntry,
} from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";
import TabToggle from "../components/TabToggle";
import Markdown from "../components/Markdown";

type HelpTab = "tutorial" | "changelog";

export default function HelpScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<HelpTab>("tutorial");

  const [tutorialContent, setTutorialContent] = useState<string | null>(null);
  const [tutorialError, setTutorialError] = useState<string | null>(null);

  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHelpTutorial()
      .then((tutorial) => {
        if (!cancelled) setTutorialContent(tutorial.content);
      })
      .catch((err) => {
        if (!cancelled) {
          setTutorialError(friendlyErrorMessage(err, t("help.couldNotLoad")));
        }
      });
    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `t` — see HubScreen.tsx for why.
  }, []);

  useEffect(() => {
    let cancelled = false;
    getChangelogEntries()
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setEntriesError(
            friendlyErrorMessage(err, t("help.changelog.couldNotLoad")),
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // Deliberately not depending on `t` — see HubScreen.tsx for why.
  }, []);

  return (
    <div className="max-w-[700px]">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
            {t("help.eyebrow")}
          </div>
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em]">
            {t("help.title")}
          </h1>
        </div>
        <TabToggle
          options={[
            { value: "tutorial", label: t("help.tabTutorial") },
            { value: "changelog", label: t("help.tabChangelog") },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "tutorial" && (
        <>
          {tutorialError && (
            <p className="text-brand-dark text-sm">{tutorialError}</p>
          )}
          {!tutorialError && tutorialContent === null && (
            <p className="text-muted text-sm">{t("common.loading")}</p>
          )}
          {!tutorialError &&
            tutorialContent !== null &&
            tutorialContent.trim() === "" && (
              <p className="text-faint text-sm">{t("help.placeholder")}</p>
            )}
          {!tutorialError &&
            tutorialContent !== null &&
            tutorialContent.trim() !== "" && (
              <div className="prose prose-sm max-w-none">
                <Markdown>{tutorialContent}</Markdown>
              </div>
            )}
        </>
      )}

      {tab === "changelog" && (
        <>
          {entriesError && (
            <p className="text-brand-dark text-sm">{entriesError}</p>
          )}
          {!entriesError && entries === null && (
            <p className="text-muted text-sm">{t("common.loading")}</p>
          )}
          {!entriesError && entries !== null && entries.length === 0 && (
            <p className="text-faint text-sm">{t("help.changelog.empty")}</p>
          )}
          {!entriesError && entries !== null && entries.length > 0 && (
            <div className="grid gap-5">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-border-soft rounded-2xl border bg-white p-5"
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="bg-chip text-chip-text rounded-full px-2.5 py-1 text-[11.5px] font-bold">
                      {entry.version}
                    </span>
                    <span className="text-faint text-[12px]">
                      {entry.entry_date}
                    </span>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <Markdown>{entry.body}</Markdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
