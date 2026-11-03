"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Btn, ErrorBox, Field, inputCls, Loading, useToast } from "@/components/ui";
import { apiPatch, apiUpload, ApiError } from "@/lib/api";
import { safeExternalUrl } from "@/lib/url";
import { useAuth } from "@/lib/auth";
import { usePublicConfig } from "@/lib/hooks";
import {
  AvatarImg,
  CoverBanner,
  SOCIAL_TILES,
  SocialTile,
  cameraIcon,
  handleOf,
  joinedLabel,
  type SocialKey,
} from "@/components/profile";
import type { UploadDoc } from "@/lib/types";

const emptySocials = () => ({ github: "", youtube: "", linkedin: "", dev: "", website: "" });

export default function StudentProfileEditPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, refresh } = useAuth();
  // Image cap comes from GET /api/v1/config (backend .env) — never hardcoded.
  const { config } = usePublicConfig();
  const maxImageMB = config?.uploadLimits.image.sizeMB;
  const maxImageBytes = maxImageMB ? maxImageMB * 1024 * 1024 : null;

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [draftSkill, setDraftSkill] = useState("");
  const [socials, setSocials] = useState<Record<SocialKey, string>>(emptySocials());
  const [saving, setSaving] = useState(false);
  // Files picked but not yet saved — shown instantly as a local preview.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (user && !initialized.current) {
      initialized.current = true;
      setName(user.name ?? "");
      setUsername(user.username ?? "");
      setBio(user.bio ?? "");
      setLocation(user.location ?? "");
      setSkills(user.skills ?? []);
      setSocials({ ...emptySocials(), ...(user.socials ?? {}) });
    }
  }, [user]);

  // Revoke local preview URLs when they are replaced or on unmount.
  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [avatarPreview, coverPreview]);

  if (loading && !user) return <Loading label="Loading profile…" />;
  if (!user) return <ErrorBox message="Could not load your profile." onRetry={() => void refresh()} />;

  // Local preview only — the file is uploaded when Save Changes is pressed.
  const pickImage = (file: File | undefined, kind: "avatar" | "cover") => {
    if (!file) return;
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) { toast("Only PNG, JPG or WebP images are allowed.", "err"); return; }
    if (maxImageBytes && file.size > maxImageBytes) { toast(`Image must be under ${maxImageMB}MB.`, "err"); return; }
    const url = URL.createObjectURL(file);
    if (kind === "avatar") {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(file);
      setAvatarPreview(url);
    } else {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverFile(file);
      setCoverPreview(url);
    }
  };

  const addSkill = () => {
    const raw = draftSkill.trim();
    if (!raw) { toast("Type an interest first, then press Enter to add it.", "err"); return; }
    if (raw.length > 40) { toast("Each interest must be 40 characters or less.", "err"); return; }
    if (skills.length >= 20) { toast("You can add up to 20 interests — remove one first.", "err"); return; }
    if (skills.some((x) => x.toLowerCase() === raw.toLowerCase())) { toast(`"${raw}" is already in your interests.`, "err"); setDraftSkill(""); return; }
    setSkills((prev) => [...prev, raw]);
    setDraftSkill("");
  };

  const save = async () => {
    if (draftSkill.trim()) { toast("Press Enter to add your typed interest before saving (or clear it).", "err"); return; }
    if (!name.trim()) { toast("Full name is required.", "err"); return; }
    if (username.trim() && !/^[A-Za-z0-9_]+$/.test(username.trim())) {
      toast("Username may only contain letters, numbers and underscores.", "err");
      return;
    }
    for (const [key, value] of Object.entries(socials)) {
      const v = value.trim();
      if (v && !safeExternalUrl(v)) { toast(`Enter a valid http(s) URL for ${key}.`, "err"); return; }
    }
    setSaving(true);
    try {
      // Upload newly picked images first so everything is saved together.
      let avatarUploadId: string | undefined;
      let coverUploadId: string | undefined;
      if (avatarFile) {
        const doc = await apiUpload<UploadDoc>("/api/v1/uploads/avatar", avatarFile);
        avatarUploadId = doc._id;
      }
      if (coverFile) {
        const doc = await apiUpload<UploadDoc>("/api/v1/uploads/cover", coverFile);
        coverUploadId = doc._id;
      }
      await apiPatch("/api/v1/me", {
        name: name.trim(),
        username: username.trim(),
        bio,
        location: location.trim(),
        skills,
        socials: Object.fromEntries(Object.entries(socials).map(([k, v]) => [k, v.trim()])),
        ...(avatarUploadId ? { avatarUploadId } : {}),
        ...(coverUploadId ? { coverUploadId } : {}),
      });
      setAvatarFile(null); setAvatarPreview(null);
      setCoverFile(null); setCoverPreview(null);
      await refresh();
      toast("Profile updated.");
      router.push("/student/profile");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not save profile.", "err");
    } finally {
      setSaving(false);
    }
  };

  const previewName = name.trim() || "Your name";
  const previewSocials = SOCIAL_TILES.filter((t) => (socials[t.key] ?? "").trim() !== "");

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <Link href="/student/profile" className="text-[15px] text-muted hover:text-ink">←&nbsp;&nbsp;Back</Link>
      <h1 className="mt-1 text-[26px] font-bold tracking-tight">Edit Profile</h1>
      <p className="text-sm text-muted">Update your profile information so others can know you better.</p>

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {/* cover + photo */}
          <section className="overflow-hidden rounded-2xl border border-line bg-card card-hover" aria-label="Cover and photo">
            <div className="relative h-44 sm:h-52">
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreview} alt="New cover preview" className="h-full w-full object-cover" />
              ) : (
                <CoverBanner uploadId={user.coverUploadId} className="h-full w-full" />
              )}
              <label className="absolute right-4 top-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-card px-3.5 py-2 text-[13px] font-semibold shadow hover:bg-soft">
                {cameraIcon}
                Change Cover
                <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden"
                  onChange={(e) => { pickImage(e.target.files?.[0], "cover"); e.target.value = ""; }} />
              </label>
            </div>
            <div className="flex items-center gap-4 p-5">
              <span className="relative z-10 -mt-14 block h-24 w-24 shrink-0 overflow-hidden rounded-full text-2xl ring-4 ring-card">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="New profile photo preview" className="h-full w-full object-cover" />
                ) : (
                  <AvatarImg uploadId={user.avatarUploadId} name={previewName} className="h-full w-full" />
                )}
              </span>
              <div>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#1d6ce0] hover:underline">
                  {cameraIcon}
                  Change Photo
                  <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden"
                    onChange={(e) => { pickImage(e.target.files?.[0], "avatar"); e.target.value = ""; }} />
                </label>
                <p className="text-xs text-muted">{avatarPreview ? "Preview — applies when you Save Changes" : maxImageMB ? `JPG, PNG up to ${maxImageMB}MB` : "JPG, PNG (server limit applies)"}</p>
              </div>
            </div>
          </section>

          {/* basic info */}
          <section className="rounded-2xl border border-line bg-card p-5 sm:p-6 card-hover" aria-label="Basic information">
            <h2 className="text-[17px] font-bold">Basic Information</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Full Name">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputCls} placeholder="Your full name" />
              </Field>
              <div>
                <Field label="Username">
                  <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={40} className={inputCls} placeholder="username" />
                </Field>
                <p className="mt-1 text-xs text-muted">Letters, numbers and underscores only — shown as @{username.trim() || "username"}.</p>
              </div>
            </div>
            <div className="mt-4">
              <Field label="Email Address">
                <input value={user.email} disabled className={`${inputCls} opacity-70`} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="About Me">
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={500} className={inputCls} placeholder="Tell others what you love learning…" />
              </Field>
              <p className="mt-1 text-right text-xs text-muted">{bio.length}/500</p>
            </div>
            <div className="mt-2">
              <Field label="Location">
                <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} className={inputCls} placeholder="City, Country" />
              </Field>
            </div>
          </section>

          {/* interests */}
          <section className="rounded-2xl border border-line bg-card p-5 sm:p-6 card-hover" aria-label="Interests and goals">
            <h2 className="text-[17px] font-bold">Interests & Goals</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-card px-3 py-2.5">
              {skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f1fe] px-3 py-1 text-[13px] font-medium text-[#1d4ed8] dark:bg-soft">
                  {s}
                  <button type="button" aria-label={`Remove ${s}`} onClick={() => setSkills((prev) => prev.filter((x) => x !== s))}
                    className="text-muted hover:text-danger">×</button>
                </span>
              ))}
              <input value={draftSkill} onChange={(e) => setDraftSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                placeholder={skills.length ? "Add another…" : "Type an interest and press Enter…"}
                maxLength={40} aria-label="Add an interest"
                className="min-w-[160px] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted/70" />
            </div>
            <p className="mt-1.5 text-xs text-muted">Add topics that you are interested in or your learning goals.</p>
          </section>

          {/* socials */}
          <section className="rounded-2xl border border-line bg-card p-5 sm:p-6 card-hover" aria-label="Social links">
            <h2 className="text-[17px] font-bold">Social Links</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {SOCIAL_TILES.map((t) => (
                <label key={t.key} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
                  <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${t.badge}`}>
                    {t.mark}
                  </span>
                  <span className="sr-only">{t.label} URL</span>
                  <input value={socials[t.key]} onChange={(e) => setSocials((prev) => ({ ...prev, [t.key]: e.target.value }))}
                    inputMode="url" placeholder={`https://…`} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70" />
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* preview rail */}
        <aside className="space-y-5 xl:sticky xl:top-20">
          <section className="overflow-hidden rounded-2xl border border-line bg-card card-hover" aria-label="Profile preview">
            <div className="p-5 pb-0">
              <h2 className="text-[17px] font-bold">Profile Preview</h2>
              <p className="text-[13px] text-muted">This is how your profile will look to others.</p>
            </div>
            <div className="relative mt-3 h-28">
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreview} alt="New cover preview" className="h-full w-full object-cover" />
              ) : (
                <CoverBanner uploadId={user.coverUploadId} className="h-full w-full" />
              )}
            </div>
            <div className="p-5">
              <span className="relative z-10 -mt-14 block h-20 w-20 overflow-hidden rounded-full text-xl ring-4 ring-card">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="New profile photo preview" className="h-full w-full object-cover" />
                ) : (
                  <AvatarImg uploadId={user.avatarUploadId} name={previewName} className="h-full w-full" />
                )}
              </span>
              <p className="mt-2 text-lg font-bold">{previewName}</p>
              <p className="text-[13px] text-muted">@{username.trim() || handleOf(user).slice(1)}</p>
              <p className="mt-1.5 whitespace-pre-line text-[13px] text-muted">{bio.trim() || "No bio yet."}</p>
              <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-[13px]">
                <p className="truncate">{user.email}</p>
                {location.trim() && <p className="truncate">{location.trim()}</p>}
                <p className="text-muted">{joinedLabel(user.joinedAt)}</p>
              </div>
              {!!skills.length && (
                <>
                  <h3 className="mt-3 border-t border-line pt-3 text-sm font-bold">Interests & Goals</h3>
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {skills.map((s) => (
                      <span key={s} className="rounded-full bg-[#e8f1fe] px-2.5 py-1 text-xs font-medium text-[#1d4ed8] dark:bg-soft">{s}</span>
                    ))}
                  </p>
                </>
              )}
              {!!previewSocials.length && (
                <>
                  <h3 className="mt-3 border-t border-line pt-3 text-sm font-bold">Social Links</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {previewSocials.map((t) => (
                      <SocialTile key={t.key} tile={t} size="sm" />
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" href="/student/profile">Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Btn>
          </div>
        </aside>
      </div>
    </div>
  );
}
