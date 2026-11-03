"use client";
import Link from "next/link";
import { ErrorBox, Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import {
  AvatarImg,
  CoverBanner,
  EditLink,
  SOCIAL_TILES,
  SocialTile,
  cameraIcon,
  handleOf,
  joinedLabel,
} from "@/components/profile";

const cardCls = "rounded-2xl border border-line bg-card p-5 sm:p-6 card-hover";

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-[15px]">
      <span aria-hidden className="text-ink">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

export default function StudentProfilePage() {
  const { user, loading, refresh } = useAuth();

  if (loading && !user) return <Loading label="Loading profile…" />;
  if (!user) return <ErrorBox message="Could not load your profile." onRetry={() => void refresh()} />;

  const name = user.name?.trim() || "Unnamed student";
  const socials = user.socials ?? { github: "", youtube: "", linkedin: "", dev: "", website: "" };
  const linked = SOCIAL_TILES.filter((t) => (socials[t.key] ?? "").trim() !== "");

  return (
    <div className="-m-4 bg-[#f7f9fc] p-4 dark:bg-bg sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      {/* cover */}
      <div className="relative h-44 overflow-hidden rounded-t-2xl sm:h-56">
        <CoverBanner uploadId={user.coverUploadId} className="h-full w-full" />
        <Link
          href="/student/profile/edit"
          className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg bg-card px-3.5 py-2 text-[13px] font-semibold shadow hover:bg-soft"
        >
          {cameraIcon}
          Change Cover
        </Link>
      </div>

      {/* identity */}
      <section className={`${cardCls} rounded-t-none`} aria-label="Profile summary">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative -mt-16 h-28 w-28 shrink-0 sm:-mt-20 sm:h-32 sm:w-32">
            <span className="block h-full w-full overflow-hidden rounded-full text-3xl ring-4 ring-card">
              <AvatarImg uploadId={user.avatarUploadId} name={name} className="h-full w-full" />
            </span>
            <Link
              href="/student/profile/edit"
              title="Change profile photo"
              aria-label="Change profile photo"
              className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted shadow hover:text-ink"
            >
              {cameraIcon}
            </Link>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold tracking-tight">{name}</h1>
            <p className="text-sm text-muted">{handleOf(user)}</p>
            <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-muted">
              {user.bio?.trim() || "No bio yet — tell others what you love learning."}
            </p>
          </div>
          <Link
            href="/student/profile/edit"
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-line bg-card px-4 py-2 text-[13px] font-semibold text-[#1d6ce0] hover:bg-[#eff6ff]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
            Edit Profile
          </Link>
        </div>
      </section>

      {/* tabs */}
      <div className="mt-4 flex gap-6 border-b border-line text-[15px] font-semibold" role="tablist" aria-label="Profile sections">
        <span role="tab" aria-selected="true" className="border-b-2 border-[#1d6ce0] px-1 pb-2 text-[#1d6ce0]">
          Overview
        </span>
      </div>

      {/* about */}
      <section className={`${cardCls} mt-4`} aria-label="About me">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[17px] font-bold">About Me</h2>
          <EditLink href="/student/profile/edit" />
        </div>
        <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-muted">
          {user.bio?.trim() || "No bio yet."}
        </p>
        <div className="mt-4 space-y-2.5 border-t border-line pt-4">
          <InfoRow
            icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>}
          >
            {user.email}
          </InfoRow>
          {user.location?.trim() && (
            <InfoRow
              icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>}
            >
              {user.location}
            </InfoRow>
          )}
          <InfoRow
            icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>}
          >
            {joinedLabel(user.joinedAt)}
          </InfoRow>
        </div>
      </section>

      {/* interests */}
      <section className={`${cardCls} mt-4`} aria-label="Interests and goals">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[17px] font-bold">Interests & Goals</h2>
          <EditLink href="/student/profile/edit" />
        </div>
        {(user.skills ?? []).length ? (
          <p className="mt-3 flex flex-wrap gap-2">
            {(user.skills ?? []).map((s) => (
              <span key={s} className="rounded-full bg-[#e8f1fe] px-3.5 py-1.5 text-[13px] font-medium text-[#1d4ed8] dark:bg-soft">
                {s}
              </span>
            ))}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">No interests added yet.</p>
        )}
      </section>

      {/* social */}
      <section className={`${cardCls} mt-4`} aria-label="Social links">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[17px] font-bold">Social Links</h2>
          <EditLink href="/student/profile/edit" />
        </div>
        {linked.length ? (
          <div className="mt-3 flex flex-wrap gap-2.5">
            {linked.map((t) => (
              <SocialTile key={t.key} tile={t} href={(socials[t.key] ?? "").trim()} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No social links yet.</p>
        )}
      </section>
    </div>
  );
}
