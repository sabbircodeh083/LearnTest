export type Role = "student" | "teacher" | "admin";
export type ContentType = "video" | "playlist" | "question" | "exam";

export interface Me {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  role: Role;
  roleSelected: boolean;
  /** False for OAuth-only accounts: deletion needs no password to verify. */
  hasPassword: boolean;
  bio: string;
  avatarUploadId: string | null;
  coverUploadId: string | null;
  joinedAt: string | null;
  status: "active" | "suspended";
  username: string;
  subject: string;
  university: string;
  degree: string;
  location: string;
  skills: string[];
  socials: { github: string; youtube: string; linkedin: string; dev: string; website: string };
  payout: {
    accountType: "" | "bank" | "mobile";
    holderName: string; bankName: string; accountNumber: string; branchName: string;
    routingNumber: string; provider: string; mobileNumber: string;
  };
}

export interface Page<T> { items: T[]; total: number; page?: number; limit?: number }

export interface ContentBase {
  _id: string;
  ownerId: string;
  title: string;
  description: string;
  tags: string[];
  visibility: "public" | "private" | "unlisted";
  status: "draft" | "published" | "hidden" | "rejected";
  price: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Video extends ContentBase {
  sourceType: "youtube" | "upload";
  youtubeId: string;
  assetUploadId: string | null;
  /** Uploaded videos only: false while the file is still being scanned. */
  mediaReady?: boolean;
  mediaStatus?: string | null;
}

export interface Playlist extends ContentBase { videoIds: string[] }

export interface Question extends ContentBase {
  type: "mcq" | "short" | "code";
  prompt: string;
  answer?: string;
  rubric?: string;
  linkedContentId: string | null;
  options: string[];
  correctOptions: number[];
  multiple: boolean;
  marks: number;
  explanation: string;
}

export interface Exam extends ContentBase {
  questionIds?: string[];
  questionCount?: number;
  startsAt?: string;
  endsAt?: string;
  durationMinutes: number;
  maxAttempts: number | null;
  accessPolicy: "free" | "paid" | "enrolled";
  passingMarks: number;
  playlistId: string | null;
  videoId: string;
  kind: "quiz" | "written" | "problem" | "project";
  // Project-kind exams only (mirrors the backend Exam schema).
  maxScore?: number | null;
  submissionTypes?: string[];
  maxFileSize?: string;
  maxFiles?: number;
  rubric?: unknown;
}

export interface ExamAttempt {
  _id: string;
  studentId: string;
  examId: string;
  attemptNumber: number;
  startedAt: string;
  submittedAt?: string;
  answers: Record<string, unknown>;
  state: "in_progress" | "submitted" | "graded";
  score: number | null;
  feedback: string;
  breakdown: { key: string; label: string; maxMarks: number; marks: number; comment: string }[];
  createdAt: string;
}

export interface AttemptStudent { userId: string; name: string; email: string; avatarUploadId?: string | null }
export interface ExamAttemptRow extends ExamAttempt { student: AttemptStudent }

export type TestKind = "quiz" | "written" | "problem" | "project";
export interface MyTest {
  _id: string;
  source: "exam";
  kind: TestKind;
  title: string;
  description: string;
  tags: string[];
  visibility: string;
  status: string;
  price: number;
  currency: string;
  videoId: string;
  deadline: string | null;
  questionCount: number;
  maxAttempts: number | null;
  maxScore: number | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface MyTestPage extends Page<MyTest> {
  counts: { all: number; published: number; drafts: number; archived: number };
}

export interface Purchase {
  _id: string;
  userId: string;
  contentType: ContentType;
  contentId: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "cancelled" | "expired" | "risk_hold" | "refunded";
  tranId: string;
  createdAt: string;
}

export interface BookmarkDoc {
  _id: string;
  userId: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadDoc {
  _id: string;
  ownerId: string;
  filename: string;
  detectedMime: string;
  size: number;
  purpose: "assignment" | "content" | "avatar" | "cover";
  relatedId: string | null;
  scanStatus: "pending_scan" | "clean" | "suspicious" | "infected" | "scan_failed" | "disabled";
  createdAt: string;
}

export interface TeacherProfile {
  userId: string; email?: string; name: string; role: Role; bio: string;
  avatarUploadId: string | null; coverUploadId?: string | null; createdAt: string;
  username?: string; subject?: string; university?: string; degree?: string; location?: string;
  skills?: string[];
  socials?: { github: string; youtube: string; linkedin: string; dev: string; website: string };
}

export interface AdminOverview {
  users: number; students: number; teachers: number;
  published: { videos: number; playlists: number; questions: number };
  exams: number;
  payments: { pending: number; paid: number; failed: number };
  pendingSubmissions: number;
  pendingPayouts: number;
}

export const idOf = (doc: { _id?: string; id?: string }) => String(doc._id ?? doc.id ?? "");
export const currencySymbol = (currency?: string | null) =>
  currency === "USD" ? "$" : currency === "BDT" ? "৳" : currency ? `${currency} ` : "";
export const priceLabel = (price?: number | null, currency?: string | null) =>
  (price ?? 0) > 0 ? `${currencySymbol(currency)}${Number(price).toLocaleString()}` : "Free";
export const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
export const fmtMoney = (amount: number, currency = "USD") =>
  `${currency} ${Number(amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
export const scanLabel: Record<UploadDoc["scanStatus"], string> = {
  pending_scan: "Pending scan", clean: "Clean", suspicious: "Suspicious",
  infected: "Infected", scan_failed: "Scan failed", disabled: "Scanning disabled (unscanned)",
};
