"use client";
import Link from "next/link";
import { Badge, statusTone } from "./ui";
import type { BadgeTone } from "./ui";
import { AvatarImg } from "./profile";
import { fmtDate, fmtMoney, idOf, type Playlist, type Question, type Video } from "@/lib/types";

export function Tags({ tags }: { tags: string[] }) {
  if (!tags?.length) return null;
  return <div className="flex flex-wrap gap-1.5">{tags.slice(0, 4).map((t) => <Badge key={t}>#{t}</Badge>)}</div>;
}

/** Badge content for a question. Written tests store every question as backend
 *  type "short" with the specific kind (Short/Long Answer, Essay) in the
 *  description — the badge shows that with its own color. */
export function questionBadge(q: { type: string; description?: string; multiple?: boolean }): { label: string; tone: BadgeTone } {
  const d = (q.description ?? "").trim();
  if (d === "Short Answer") return { label: d, tone: "blue" };
  if (d === "Long Answer") return { label: d, tone: "purple" };
  if (d === "Essay") return { label: d, tone: "orange" };
  if (q.type === "mcq") return { label: q.multiple ? "Multiple" : "MCQ", tone: "green" };
  if (q.type === "code") return { label: "Code", tone: "orange" };
  return { label: q.type.toUpperCase(), tone: "blue" };
}

export function PriceTag({ price, currency }: { price: number; currency: string }) {
  return price > 0
    ? <Badge tone="amber">{fmtMoney(price, currency)} · Paid</Badge>
    : <Badge tone="green">Free</Badge>;
}

export function VideoCard({ video, href }: { video: Video; href?: string }) {
  const link = href ?? `/student/videos/${idOf(video)}`;
  const thumb = video.youtubeId ? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg` : null;
  return (
    <article className="h-full overflow-hidden rounded-xl border border-line bg-card card-hover">
      <Link href={link} className="block">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="aspect-video w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-soft text-sm font-semibold text-muted">LearnTest video</div>
        )}
      </Link>
      <div className="space-y-2 p-4">
        <Link href={link} className="line-clamp-2 font-semibold leading-snug hover:text-brandstrong">{video.title}</Link>
        <p className="line-clamp-2 text-sm text-muted">{video.description || "No description provided."}</p>
        <div className="flex flex-wrap items-center gap-2">
          <PriceTag price={video.price} currency={video.currency} />
          <Badge tone={statusTone(video.status)}>{video.status}</Badge>
          <span className="text-xs text-muted">{fmtDate(video.createdAt)}</span>
        </div>
        <Tags tags={video.tags} />
      </div>
    </article>
  );
}

export function QuestionCard({ question, href }: { question: Question; href?: string }) {
  const link = href ?? `/student/questions/${idOf(question)}`;
  const badge = questionBadge(question);
  return (
    <article className="rounded-xl border border-line bg-card p-4 card-hover">
      <div className="flex items-start justify-between gap-3">
        <Link href={link} className="font-semibold leading-snug hover:text-brandstrong">{question.title}</Link>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <p className="mt-2 line-clamp-3 text-sm text-muted">{question.prompt}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriceTag price={question.price} currency={question.currency} />
        <span className="text-xs text-muted">{fmtDate(question.createdAt)}</span>
      </div>
      <div className="mt-3"><Tags tags={question.tags} /></div>
    </article>
  );
}

export interface PlaylistCreator { name: string; avatarUploadId: string | null; href?: string }

export function PlaylistCard({ playlist, thumbnailUrl, href, action, creator }: { playlist: Playlist; thumbnailUrl?: string | null; href?: string; action?: React.ReactNode; creator?: PlaylistCreator }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-card card-hover">
      {thumbnailUrl ? (
        href ? (
          <Link href={href} className="block" aria-label={playlist.title}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailUrl} alt="" loading="lazy" className="aspect-video w-full shrink-0 object-cover" />
          </Link>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" loading="lazy" className="aspect-video w-full shrink-0 object-cover" />
        )
      ) : null}
      <div className="flex flex-1 flex-col p-4">
      <p className="font-semibold">{href ? <Link href={href} className="hover:text-brandstrong">{playlist.title}</Link> : playlist.title}</p>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{playlist.description || "No description provided."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{playlist.videoIds?.length ?? 0} videos</Badge>
        <PriceTag price={playlist.price} currency={playlist.currency} />
        <Badge tone={statusTone(playlist.status)}>{playlist.status}</Badge>
      </div>
      <div className="mt-3"><Tags tags={playlist.tags} /></div>
      {(creator || action) && (
        <div className="mt-3 flex items-center gap-2">
          {creator && (
            <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-muted">
              {creator.href ? (
                <Link href={creator.href} className="flex min-w-0 items-center gap-2 hover:text-brandstrong" aria-label={`View ${creator.name}'s profile`}>
                  <AvatarImg uploadId={creator.avatarUploadId} name={creator.name} className="h-6 w-6 shrink-0 rounded-full text-[10px]" />
                  <span className="truncate font-semibold">{creator.name}</span>
                </Link>
              ) : (
                <span className="flex min-w-0 items-center gap-2">
                  <AvatarImg uploadId={creator.avatarUploadId} name={creator.name} className="h-6 w-6 shrink-0 rounded-full text-[10px]" />
                  <span className="truncate font-semibold">{creator.name}</span>
                </span>
              )}
            </div>
          )}
          {action && <span className="ml-auto shrink-0">{action}</span>}
        </div>
      )}
      </div>
    </article>
  );
}
