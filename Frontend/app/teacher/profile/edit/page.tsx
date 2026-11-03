"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorBox, Loading, useToast } from "@/components/ui";
import { apiPatch, apiUpload, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePublicConfig } from "@/lib/hooks";
import { AvatarImg, CoverBanner } from "@/components/profile";
import type { UploadDoc } from "@/lib/types";

const inputCls = "w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/70 shadow-[0_1px_3px_rgba(16,24,40,0.10)] outline-none focus:border-line focus:shadow-[0_2px_8px_rgba(16,24,40,0.12)] disabled:opacity-60";
const cardCls = "rounded-xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] sm:p-6 card-hover";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm text-muted">{children}</span>;
}

const SUBJECTS = [
  "Computer Science", "Software Engineering", "Data Science", "Web Development",
  "Competitive Programming", "Mathematics", "Physics", "Chemistry", "Biology", "English", "Other",
];

const SOCIAL_META = [
  { key: "github", label: "GitHub", badge: "bg-[#111827] text-white", mark: "GH" },
  { key: "youtube", label: "YouTube", badge: "bg-[#dc2626] text-white", mark: "YT" },
  { key: "linkedin", label: "LinkedIn", badge: "bg-[#0a66c2] text-white", mark: "in" },
  { key: "dev", label: "DEV", badge: "bg-black text-white", mark: "DEV" },
  { key: "website", label: "Website", badge: "bg-[#1d6ce0] text-white", mark: "✦" },
] as const;
type SocialKey = (typeof SOCIAL_META)[number]["key"];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] || "" : parts[0][1] || "")).toUpperCase();
}

export default function EditTeacherProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, refresh } = useAuth();
  // Image cap comes from GET /api/v1/config (backend .env) — never hardcoded.
  const { config } = usePublicConfig();
  const maxImageMB = config?.uploadLimits.image.sizeMB;
  const maxImageBytes = maxImageMB ? maxImageMB * 1024 * 1024 : null;

  const [name, setName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [university, setUniversity] = useState<string | null>(null);
  const [degree, setDegree] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[] | null>(null);
  const [skillDraft, setSkillDraft] = useState("");
  const [socials, setSocials] = useState<Record<SocialKey, string> | null>(null);
  const [saving, setSaving] = useState(false);
  // Files picked but not yet saved — shown instantly as a local preview.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!loading && user) {
    if (name === null) setName(user.name ?? "");
    if (username === null) setUsername(user.username ?? "");
    if (subject === null) setSubject(user.subject ?? "");
    if (bio === null) setBio(user.bio ?? "");
    if (university === null) setUniversity(user.university ?? "");
    if (degree === null) setDegree(user.degree ?? "");
    if (location === null) setLocation(user.location ?? "");
    if (skills === null) setSkills(user.skills ?? []);
    if (socials === null) setSocials({ ...(user.socials ?? { github: "", youtube: "", linkedin: "", dev: "", website: "" }) });
  }

  const vName = name ?? "";
  const vUsername = username ?? "";
  const vSubject = subject ?? "";
  const vBio = bio ?? "";
  const vSkills = skills ?? [];
  const vSocials = socials ?? { github: "", youtube: "", linkedin: "", dev: "", website: "" };
  const atName = vUsername ? `@${vUsername}` : user?.email ? `@${user.email.split("@")[0]}` : "";

  const addSkill = () => {
    const t = skillDraft.trim().replace(/,+$/, "");
    if (!t) { toast("Type a skill first, then press Enter to add it.", "err"); return; }
    if (t.length > 40) { toast("Each skill must be 40 characters or less.", "err"); return; }
    if (vSkills.length >= 20) { toast("You can add at most 20 skills — remove one first.", "err"); return; }
    if (vSkills.some((s) => s.toLowerCase() === t.toLowerCase())) { toast(`"${t}" is already in your skills.`, "err"); setSkillDraft(""); return; }
    setSkills([...vSkills, t]);
    setSkillDraft("");
  };

  // Revoke local preview URLs when they are replaced or on unmount.
  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [avatarPreview, coverPreview]);

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

  const save = async () => {
    setError("");
    if (!vName.trim()) { setError("Full name is required."); return; }
    if (vUsername && !/^[A-Za-z0-9_]+$/.test(vUsername)) { setError("Username may only contain letters, numbers and underscores."); return; }
    if (vBio.length > 1000) { setError("About Me must be 1000 characters or less."); return; }
    for (const m of SOCIAL_META) {
      const url = vSocials[m.key].trim();
      if (url && !/^https?:\/\/.+\..+/.test(url)) { setError(`${m.label} link must start with http(s)://.`); return; }
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
        name: vName.trim(), username: vUsername.trim(), subject: vSubject,
        bio: vBio, university: (university ?? "").trim(), degree: (degree ?? "").trim(),
        location: (location ?? "").trim(), skills: vSkills,
        socials: Object.fromEntries((Object.keys(vSocials) as SocialKey[]).map((k) => [k, vSocials[k].trim()])),
        ...(avatarUploadId ? { avatarUploadId } : {}),
        ...(coverUploadId ? { coverUploadId } : {}),
      });
      setAvatarFile(null); setAvatarPreview(null);
      setCoverFile(null); setCoverPreview(null);
      await refresh();
      toast("Profile saved.");
      router.push("/teacher/profile");
    } catch (e) {
      setError(e instanceof ApiError ? `Save failed (${e.status}): ${e.message}` : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <div className="flex items-start gap-3">
        <Link href="/teacher/profile" aria-label="Back to profile"
          className="mt-1 rounded-lg p-1.5 text-muted hover:bg-soft hover:text-ink">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        </Link>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Edit Profile</h1>
          <p className="text-[15px] text-muted">Update your profile information, so students can know you better.</p>
        </div>
      </div>

      {loading || !user ? <div className="mt-6"><Loading label="Loading profile…" /></div>
        : (
          <div className="mt-4 grid items-start gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              {/* cover + photo */}
              <section className="overflow-hidden rounded-xl border border-line bg-card shadow-[0_1px_2px_rgba(16,24,40,0.05)] card-hover" aria-label="Cover and photo">
                <div className="relative h-36 bg-gradient-to-r from-[#3b5bdb] via-[#748ffc] to-[#9775fa] sm:h-44" role="img" aria-label="Profile cover">
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPreview} alt="New cover preview" className="absolute inset-0 h-full w-full object-cover" />
                  ) : user?.coverUploadId ? (
                    <CoverBanner uploadId={user.coverUploadId} className="absolute inset-0 h-full w-full" />
                  ) : (
                    <div aria-hidden className="absolute inset-0 opacity-30 [background:radial-gradient(60%_90%_at_20%_100%,#fff_0%,transparent_60%),radial-gradient(50%_80%_at_80%_20%,#fff_0%,transparent_55%)]" />
                  )}
                  <label className="absolute right-4 top-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-card px-3.5 py-2 text-[13px] font-semibold shadow hover:bg-soft">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
                    Change Cover
                    <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden"
                      onChange={(e) => { pickImage(e.target.files?.[0], "cover"); e.target.value = ""; }} />
                  </label>
                </div>
                <div className="flex items-center gap-4 p-5">
                  <div className="relative z-10 -mt-14 h-24 w-24 shrink-0">
                    <span aria-hidden className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#e8f1fe] text-2xl font-bold text-[#1d6ce0] ring-4 ring-card">
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarPreview} alt="New profile photo preview" className="h-full w-full object-cover" />
                      ) : user?.avatarUploadId ? (
                        <AvatarImg uploadId={user.avatarUploadId} name={vName || user.name || "?"} className="h-full w-full" />
                      ) : (
                        initialsOf(vName || user.name || "?")
                      )}
                    </span>
                    <label aria-label="Change photo"
                      className="absolute bottom-0 right-0 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-line bg-card text-muted shadow hover:text-ink">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
                      <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden"
                        onChange={(e) => { pickImage(e.target.files?.[0], "avatar"); e.target.value = ""; }} />
                    </label>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[#1d6ce0]">Change Photo</p>
                    <p className="text-[13px] text-muted">{avatarPreview || coverPreview ? "Preview — applies when you Save Changes" : maxImageMB ? `JPG, PNG up to ${maxImageMB}MB` : "JPG, PNG (server limit applies)"}</p>
                  </div>
                </div>
              </section>

              {/* basic info */}
              <section className={cardCls} aria-label="Basic Information">
                <h2 className="text-[17px] font-bold">Basic Information</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Full Name</Label>
                    <input value={vName} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Md Sabbir Sikder" className={inputCls} />
                  </div>
                  <div>
                    <Label>Username</Label>
                    <input value={vUsername} onChange={(e) => setUsername(e.target.value)} maxLength={40} placeholder="sabbircodeh083" className={inputCls} />
                    {vUsername && <p className="mt-1.5 text-[13px] text-muted">This will be your profile link: learntest.com/@{vUsername}</p>}
                  </div>
                  <div>
                    <Label>Role</Label>
                    <select value="Teacher" disabled className={inputCls} aria-label="Role (fixed)">
                      <option>Teacher</option>
                    </select>
                  </div>
                  <div>
                    <Label>Subject / Field</Label>
                    <select value={vSubject} onChange={(e) => setSubject(e.target.value)} className={inputCls}>
                      <option value="">Select a subject…</option>
                      {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* about */}
              <section className={cardCls} aria-label="About Me">
                <h2 className="text-[17px] font-bold">About Me</h2>
                <textarea value={vBio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={1000}
                  placeholder="I create practical and beginner-friendly content…" className={`${inputCls} mt-3`} />
                <p className="mt-1 text-right text-xs text-muted">{vBio.length}/500</p>
              </section>

              {/* education */}
              <section className={cardCls} aria-label="Education and Location">
                <h2 className="text-[17px] font-bold">Education & Location</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>University / Institution</Label>
                    <input value={university ?? ""} onChange={(e) => setUniversity(e.target.value)} maxLength={160}
                      placeholder="American International University Bangladesh (AIUB)" className={inputCls} />
                  </div>
                  <div>
                    <Label>Degree</Label>
                    <input value={degree ?? ""} onChange={(e) => setDegree(e.target.value)} maxLength={160}
                      placeholder="BSc in Computer Science" className={inputCls} />
                  </div>
                </div>
                <div className="mt-4">
                  <Label>Location</Label>
                  <input value={location ?? ""} onChange={(e) => setLocation(e.target.value)} maxLength={120}
                    placeholder="Dhaka, Bangladesh" className={inputCls} />
                </div>
              </section>

              {/* skills */}
              <section className={cardCls} aria-label="Skills and Topics">
                <h2 className="text-[17px] font-bold">Skills & Topics</h2>
                <div className={`${inputCls} mt-3 flex flex-wrap items-center gap-2 !py-2`}>
                  {vSkills.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5 rounded-md bg-[#eff6ff] px-2.5 py-1 text-sm font-medium text-[#1d4ed8]">
                      {s}
                      <button type="button" aria-label={`Remove ${s}`}
                        onClick={() => setSkills(vSkills.filter((x) => x !== s))} className="text-muted hover:text-danger">×</button>
                    </span>
                  ))}
                  <input value={skillDraft} onChange={(e) => setSkillDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                    onBlur={() => { if (skillDraft.trim()) addSkill(); }}
                    placeholder={vSkills.length ? "" : "Add topics and press Enter..."}
                    aria-label="Add a topic and press Enter" className="min-w-[160px] flex-1 bg-transparent py-1 outline-none placeholder:text-muted/70" />
                </div>
                <p className="mt-1.5 text-[13px] text-muted">Add topics that you teach or create content about.</p>
              </section>

              {/* socials */}
              <section className={cardCls} aria-label="Social Links">
                <h2 className="text-[17px] font-bold">Social Links</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {SOCIAL_META.map((m) => (
                    <div key={m.key} className="flex items-center gap-2 rounded-lg border border-line px-2.5 shadow-[0_1px_3px_rgba(16,24,40,0.10)]">
                      <span aria-hidden className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-black ${m.badge}`}>{m.mark}</span>
                      <input value={vSocials[m.key]} onChange={(e) => setSocials({ ...vSocials, [m.key]: e.target.value })}
                        inputMode="url" placeholder={`https://…`} aria-label={m.label}
                        className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted/70" />
                    </div>
                  ))}
                </div>
              </section>

              {error && <ErrorBox message={error} onRetry={() => setError("")} />}
            </div>

            {/* preview */}
            <aside className="xl:sticky xl:top-20" aria-label="Profile Preview">
              <div className={cardCls}>
                <h2 className="text-[17px] font-bold">Profile Preview</h2>
                <p className="text-[13px] text-muted">This is how your profile will look to students.</p>
                <div className="mt-3 overflow-hidden rounded-xl border border-line">
                  <div className="relative h-24 bg-gradient-to-r from-[#3b5bdb] via-[#748ffc] to-[#9775fa]">
                    {coverPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverPreview} alt="New cover preview" className="absolute inset-0 h-full w-full object-cover" />
                    ) : user?.coverUploadId ? (
                      <CoverBanner uploadId={user.coverUploadId} className="absolute inset-0 h-full w-full" />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <div className="relative z-10 -mt-11 mb-2 h-20 w-20">
                      <span aria-hidden className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#e8f1fe] text-xl font-bold text-[#1d6ce0] ring-4 ring-card">
                        {avatarPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarPreview} alt="New profile photo preview" className="h-full w-full object-cover" />
                        ) : user?.avatarUploadId ? (
                          <AvatarImg uploadId={user.avatarUploadId} name={vName || "?"} className="h-full w-full" />
                        ) : (
                          initialsOf(vName || "?")
                        )}
                      </span>
                    </div>
                    <p className="text-lg font-bold tracking-tight">{vName.trim() || "Your name"}</p>
                    {atName && <p className="text-sm text-muted">{atName}</p>}
                    <p className="mt-0.5 text-sm font-medium">Teacher{vSubject ? ` • ${vSubject}` : ""}</p>
                    {vBio.trim() && <p className="mt-1.5 line-clamp-4 text-[13px] text-muted">{vBio.trim()}</p>}
                    {(university ?? "").trim() && (
                      <p className="mt-2.5 flex items-start gap-2 text-[13px]">
                        <svg viewBox="0 0 24 24" aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m12 4 10 5-10 5L2 9z" /><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" /></svg>
                        <span><span className="font-semibold">{(university ?? "").trim()}</span>{(degree ?? "").trim() && <span className="block text-muted">{(degree ?? "").trim()}</span>}</span>
                      </p>
                    )}
                    {(location ?? "").trim() && (
                      <p className="mt-1.5 flex items-center gap-2 text-[13px]">
                        <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                        {(location ?? "").trim()}
                      </p>
                    )}
                    {!!vSkills.length && (
                      <p className="mt-2.5 flex flex-wrap gap-1.5">
                        {vSkills.slice(0, 7).map((s) => (
                          <span key={s} className="rounded-md bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#1d4ed8]">{s}</span>
                        ))}
                      </p>
                    )}
                    <p className="mt-2.5 flex flex-wrap gap-1.5">
                      {SOCIAL_META.filter((m) => vSocials[m.key].trim()).map((m) => (
                        <span key={m.key} aria-hidden className={`flex h-7 w-9 items-center justify-center rounded-md text-[11px] font-black ${m.badge}`}>{m.mark}</span>
                      ))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Link href="/teacher/profile"
                  className="rounded-xl border border-line bg-card px-6 py-3 text-sm font-semibold text-[#1d6ce0] hover:bg-soft">
                  Cancel
                </Link>
                <button type="button" onClick={() => void save()} disabled={saving}
                  className="rounded-xl bg-[#1d6ce0] px-6 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </aside>
          </div>
        )}
    </div>
  );
}
