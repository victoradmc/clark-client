import { useEffect, useState } from "react";
import {
  changePassword,
  deleteOwnAccount,
  getProfile,
  updateProfile,
  type Profile,
} from "../data/clarkApi";

function initialsFor(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getProfile();
        if (cancelled) return;
        setProfile(found);
        setName(found.name);
        setEmail(found.email);
        setBio(found.bio);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Could not load your profile.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (newPassword && newPassword !== confirmPassword) {
      setSaveError("New password and confirmation don't match.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateProfile({ name, email, bio });
      // Reflect the persisted profile fields immediately, even if the
      // password step below fails — that write already succeeded in the DB.
      setProfile(updated);
      if (newPassword) {
        await changePassword(newPassword);
      }
      setNewPassword("");
      setConfirmPassword("");
      setSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not save changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClick() {
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOwnAccount();
      // No navigation needed — App's session listener swaps to LoginScreen
      // once deleteOwnAccount's internal signOut fires.
    } catch (err) {
      setDeleting(false);
      setDeleteConfirming(false);
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete your account.",
      );
    }
  }

  if (loadError) {
    return <p className="text-brand-dark text-sm">{loadError}</p>;
  }

  if (!profile) {
    return <p className="text-muted text-sm">Loading…</p>;
  }

  return (
    <div className="max-w-[520px]">
      <div className="text-brand mb-1.5 text-xs font-bold tracking-[.06em] uppercase">
        Account
      </div>
      <h1 className="mb-7 text-[28px] font-extrabold tracking-[-0.02em]">
        Your profile
      </h1>

      <div className="mb-7 flex items-center gap-4.5">
        <div className="bg-brand-tint border-border-soft flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full border text-[28px] font-bold text-brand">
          {initialsFor(name) || "?"}
        </div>
        <div>
          <div className="text-base font-bold">{name || "—"}</div>
          <div className="text-faint text-[13px]">
            Avatar shown as initials from your name
          </div>
        </div>
      </div>

      <div className="border-border-soft grid gap-4 rounded-2xl border bg-white p-6">
        <div>
          <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
            Name
          </label>
          <input
            className="border-border focus:outline-brand w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
            Email
          </label>
          <input
            type="email"
            className="border-border focus:outline-brand w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
            Bio
          </label>
          <textarea
            className="border-border focus:outline-brand min-h-[70px] w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm leading-relaxed focus:outline-2 focus:outline-offset-1"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
      </div>

      <div className="border-border-soft mt-4 grid gap-4 rounded-2xl border bg-white p-6">
        <div className="text-[13px] font-bold">Change password</div>
        <div>
          <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
            New password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            className="border-border focus:outline-brand w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="text-label mb-1.5 block text-[12.5px] font-semibold">
            Confirm new password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            className="border-border focus:outline-brand w-full rounded-[11px] border bg-white px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      </div>

      {saveError && (
        <p className="text-brand-dark mt-3 text-[13px]">{saveError}</p>
      )}
      {saved && !saveError && (
        <p className="mt-3 text-[13px] font-semibold text-[#1D7A3E]">
          Profile updated.
        </p>
      )}

      <div className="mt-4.5 flex gap-2.5">
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() => void handleSave()}
          className="bg-brand rounded-[11px] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="border-border-soft mt-10 border-t pt-6">
        <div className="mb-1.5 text-[13px] font-bold">Delete account</div>
        <p className="text-faint mb-3 max-w-[50ch] text-[12.5px]">
          This permanently removes your lessons, tests and profile. This
          cannot be undone.
        </p>
        {deleteError && (
          <p className="text-brand-dark mb-2 text-[12.5px]">{deleteError}</p>
        )}
        <button
          type="button"
          disabled={deleting}
          onClick={() => void handleDeleteClick()}
          className="border-brand text-brand rounded-[11px] border-[1.5px] bg-white px-[18px] py-2.5 text-[13.5px] font-bold disabled:opacity-60"
        >
          {deleting
            ? "Deleting…"
            : deleteConfirming
              ? "Click again to confirm deletion"
              : "Delete my account"}
        </button>
      </div>
    </div>
  );
}
