import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createLesson, type LessonVisibility } from "../data/clarkApi";
import { friendlyErrorMessage } from "../data/errorMessage";
import {
  parseLessonJson,
  validateLessonFields,
  type ParsedLessonFields,
} from "../data/lessonValidation";
import Badge from "../components/Badge";
import TabToggle from "../components/TabToggle";

type UploadMode = "json" | "form";

export default function UploadLessonScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<UploadMode>("form");

  const [text, setText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedLessonFields | null>(null);
  const [phase, setPhase] = useState<"upload" | "publish">("upload");

  const [formTitle, setFormTitle] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formOrigin, setFormOrigin] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<LessonVisibility>("public");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleParse() {
    try {
      setParsed(parseLessonJson(text));
      setParseError(null);
    } catch (err) {
      setParsed(null);
      setParseError(friendlyErrorMessage(err, t("uploadLesson.couldNotParse")));
    }
  }

  function handleContinue() {
    if (!parsed) return;
    setTitle(parsed.title);
    setVisibility("public");
    setPhase("publish");
  }

  // Same validateLessonFields rules the JSON path uses (via parseLessonJson)
  // — a hand-typed Lesson has no JSON to parse, but the required-field
  // checks and the Origin default are identical either way.
  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const fields = validateLessonFields({
        title: formTitle,
        content: formContent,
        subject: formSubject,
        origin: formOrigin,
      });
      setFormError(null);
      setParsed(fields);
      setTitle(fields.title);
      setVisibility("public");
      setPhase("publish");
    } catch (err) {
      setFormError(friendlyErrorMessage(err, t("uploadLesson.couldNotCreate")));
    }
  }

  async function handlePublish() {
    if (!parsed) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const lesson = await createLesson({
        title,
        content: parsed.content,
        subject: parsed.subject,
        origin: parsed.origin,
        visibility,
      });
      navigate(`/lessons/${lesson.id}`);
    } catch (err) {
      setPublishError(
        friendlyErrorMessage(err, t("uploadLesson.couldNotPublish")),
      );
    } finally {
      setPublishing(false);
    }
  }

  if (phase === "publish" && parsed) {
    return (
      <div className="max-w-[460px]">
        <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
          {t("uploadLesson.publishEyebrow")}
        </div>
        <h1 className="mb-6 text-[26px] font-extrabold tracking-[-0.02em]">
          {t("uploadLesson.publishTitle")}
        </h1>
        <div className="grid gap-4">
          <div>
            <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
              {t("uploadLesson.titleLabel")}
            </label>
            <input
              className="border-border focus:outline-brand w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Badge>{parsed.subject}</Badge>
            <Badge>{parsed.origin}</Badge>
          </div>
          <div>
            <label className="text-label mb-2 block text-[12.5px] font-semibold">
              {t("uploadLesson.visibilityLabel")}
            </label>
            <div className="grid gap-2">
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 ${
                  visibility === "public"
                    ? "border-brand bg-brand-tint"
                    : "border-border bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                />
                <span className="text-[13.5px]">
                  {t("uploadLesson.publicOption")}
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 ${
                  visibility === "private"
                    ? "border-brand bg-brand-tint"
                    : "border-border bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                />
                <span className="text-[13.5px]">
                  {t("uploadLesson.privateOption")}
                </span>
              </label>
            </div>
          </div>
        </div>
        {publishError && (
          <p className="text-brand-dark mt-3 text-[13px]">{publishError}</p>
        )}
        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            disabled={publishing || !title.trim()}
            onClick={() => void handlePublish()}
            className="bg-brand rounded-[11px] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {publishing ? t("uploadLesson.publishing") : t("uploadLesson.savePublish")}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-muted rounded-[11px] bg-transparent px-4 py-2.5 text-sm font-semibold"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <div className="text-brand text-xs font-bold tracking-[.06em] uppercase">
          {t("uploadLesson.eyebrow")}
        </div>
        <TabToggle
          options={[
            { value: "form", label: t("uploadLesson.tabForm") },
            { value: "json", label: t("uploadLesson.tabJson") },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>

      {mode === "form" ? (
        <>
          <h1 className="mb-2 text-[28px] font-extrabold tracking-[-0.02em]">
            {t("uploadLesson.formTitle")}
          </h1>
          <p className="text-muted mb-5 max-w-[60ch] text-[13.5px]">
            {t("uploadLesson.formDescription")}
          </p>

          <form onSubmit={handleFormSubmit} className="grid max-w-[600px] gap-4">
            <div>
              <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
                {t("uploadLesson.titleLabel")}
              </label>
              <input
                className="border-border focus:outline-brand w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
                {t("uploadLesson.subjectLabel")}
              </label>
              <input
                className="border-border focus:outline-brand w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
                {t("uploadLesson.originLabel")}
              </label>
              <input
                className="border-border focus:outline-brand w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
                value={formOrigin}
                onChange={(e) => setFormOrigin(e.target.value)}
              />
            </div>
            <div>
              <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
                {t("uploadLesson.contentLabel")}
              </label>
              <textarea
                className="border-border focus:outline-brand min-h-[320px] w-full rounded-2xl border bg-white p-4 text-sm leading-relaxed focus:outline-2 focus:outline-offset-1"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder={t("uploadLesson.contentPlaceholder")}
              />
            </div>
            {formError && (
              <p className="text-brand-dark text-[12.5px]">{formError}</p>
            )}
            <button
              type="submit"
              className="bg-brand w-fit rounded-[11px] px-5 py-2.5 text-sm font-bold text-white"
            >
              {t("uploadLesson.continueToPublish")}
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="mb-2 text-[28px] font-extrabold tracking-[-0.02em]">
            {t("uploadLesson.jsonTitle")}
          </h1>
          <p className="text-muted mb-5 max-w-[60ch] text-[13.5px]">
            {t("uploadLesson.jsonDescription")}
          </p>

          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="text-sm"
            />
          </div>

          <label htmlFor="lesson-json" className="sr-only">
            {t("uploadLesson.jsonTextareaLabel")}
          </label>
          <textarea
            id="lesson-json"
            className="border-border focus:outline-brand min-h-[280px] w-full rounded-2xl border bg-white p-4 font-mono text-[12.5px] leading-relaxed focus:outline-2 focus:outline-offset-1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{"title": "...", "content": "...", "subject": "...", "origin": "..."}'
          />
          {parseError && (
            <p className="text-brand-dark mt-2.5 text-[12.5px]">{parseError}</p>
          )}

          <div className="mt-[18px]">
            <button
              type="button"
              onClick={handleParse}
              className="bg-brand rounded-[11px] px-5 py-2.5 text-sm font-bold text-white"
            >
              {t("uploadLesson.parseAndPreview")}
            </button>
          </div>

          {parsed && (
            <div className="border-border-soft mt-6 max-w-[600px] rounded-2xl border bg-white p-[22px]">
              <div className="text-faint mb-2 text-[11.5px] font-bold tracking-[.06em] uppercase">
                {t("uploadLesson.previewLabel")}
              </div>
              <div className="mb-2.5 text-lg font-bold">{parsed.title}</div>
              <div className="mb-3 flex gap-2">
                <Badge tone="brand">{parsed.subject}</Badge>
                <Badge>{parsed.origin}</Badge>
              </div>
              <p className="text-chip-text mb-4 text-[13.5px] leading-relaxed">
                {parsed.content.replace(/[#*_-]+/g, " ").slice(0, 160)}…
              </p>
              <button
                type="button"
                onClick={handleContinue}
                className="border-border rounded-[10px] border bg-white px-[18px] py-2.5 text-[13.5px] font-semibold"
              >
                {t("uploadLesson.continueToPublish")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
