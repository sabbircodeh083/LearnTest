import mongoose, { Schema, type InferSchemaType } from "mongoose";

const opts = { timestamps: true as const };
export const ROLES = ["student", "teacher", "admin"] as const;
export type Role = (typeof ROLES)[number];
export const CONTENT_TYPES = [
  "video",
  "playlist",
  "question",
  "exam",
] as const;

// Role lives ONLY in the Better Auth `user` collection — never on profiles.
// Every role read must come from the user collection; profiles keep identity
// fields (name/bio/avatar/status) plus a roleSelected onboarding mirror.
const profileSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    name: { type: String, maxlength: 120, default: "" },
    roleSelected: { type: Boolean, default: false },
    bio: { type: String, maxlength: 1000, default: "" },
    avatarUploadId: { type: String, default: null },
    coverUploadId: { type: String, default: null },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    suspensionReason: { type: String, maxlength: 500, default: "" },
    // Editable teacher profile fields (shown on the public profile page).
    username: { type: String, maxlength: 40, default: "" },
    subject: { type: String, maxlength: 80, default: "" },
    university: { type: String, maxlength: 160, default: "" },
    degree: { type: String, maxlength: 160, default: "" },
    location: { type: String, maxlength: 120, default: "" },
    skills: [{ type: String, maxlength: 40 }],
    socials: {
      github: { type: String, maxlength: 2048, default: "" },
      youtube: { type: String, maxlength: 2048, default: "" },
      linkedin: { type: String, maxlength: 2048, default: "" },
      dev: { type: String, maxlength: 2048, default: "" },
      website: { type: String, maxlength: 2048, default: "" },
    },
    // Payout account for teacher earnings (editable in Settings).
    payout: {
      accountType: { type: String, enum: ["", "bank", "mobile"], default: "" },
      holderName: { type: String, maxlength: 120, default: "" },
      bankName: { type: String, maxlength: 160, default: "" },
      accountNumber: { type: String, maxlength: 32, default: "" },
      branchName: { type: String, maxlength: 160, default: "" },
      routingNumber: { type: String, maxlength: 32, default: "" },
      provider: { type: String, maxlength: 40, default: "" },
      mobileNumber: { type: String, maxlength: 20, default: "" },
    },
  },
  opts,
);
export const Profile =
  mongoose.models.Profile || mongoose.model("Profile", profileSchema);

const price = {
  price: { type: Number, min: 0, default: 0 },
  currency: { type: String, length: 3, default: "USD" },
};
const contentBase = {
  ownerId: { type: String, required: true, index: true },
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 5000, default: "" },
  tags: [{ type: String, maxlength: 40 }],
  visibility: {
    type: String,
    enum: ["public", "private", "unlisted"],
    default: "public",
    index: true,
  },
  status: {
    type: String,
    enum: ["draft", "published", "hidden", "rejected"],
    default: "draft",
    index: true,
  },
  ...price,
};
const videoSchema = new Schema(
  {
    ...contentBase,
    sourceType: { type: String, enum: ["youtube", "upload"], required: true },
    youtubeId: { type: String, maxlength: 32, default: "" },
    assetUploadId: { type: String, default: null },
  },
  opts,
);
videoSchema.index({ ownerId: 1, status: 1 });
videoSchema.index({ tags: 1, status: 1 });
export const Video =
  mongoose.models.Video || mongoose.model("Video", videoSchema);

const playlistSchema = new Schema(
  { ...contentBase, videoIds: [{ type: String }] },
  opts,
);
export const Playlist =
  mongoose.models.Playlist || mongoose.model("Playlist", playlistSchema);

const questionSchema = new Schema(
  {
    ...contentBase,
    type: { type: String, enum: ["mcq", "short", "code"], required: true },
    prompt: { type: String, required: true, maxlength: 5000 },
    answer: { type: String, maxlength: 10000, default: "" },
    rubric: { type: String, maxlength: 10000, default: "" },
    linkedContentId: { type: String, default: null },
    // MCQ authoring: options shown to students, correctOptions = indexes into options.
    options: { type: [String], default: [] },
    correctOptions: { type: [Number], default: [] },
    multiple: { type: Boolean, default: false }, // true = select-all-that-apply
    marks: { type: Number, min: 0, max: 1000, default: 1 },
    explanation: { type: String, maxlength: 5000, default: "" }, // revealed after grading
  },
  opts,
);
export const Question =
  mongoose.models.Question || mongoose.model("Question", questionSchema);

const examSchema = new Schema(
  {
    ...contentBase,
    questionIds: [{ type: String }],
    startsAt: Date,
    endsAt: Date,
    durationMinutes: { type: Number, min: 1, max: 1440, required: true },
    maxAttempts: { type: Number, min: 1, max: 20, default: 1 },
    accessPolicy: {
      type: String,
      enum: ["free", "paid", "enrolled"],
      default: "free",
    },
    passingMarks: { type: Number, min: 0, default: 0 },
    playlistId: { type: String, default: null },
    videoId: { type: String, maxlength: 100, default: "" },
    kind: { type: String, enum: ["quiz", "written", "problem", "project"], default: "quiz", index: true },
    // Project support: projects live in Exams (kind="project"); each allowed
    // submission slot (ZIP/Git/Live/PDF link or file) is a Question in questionIds.
    maxScore: { type: Number, min: 1, max: 10000, default: null },
    submissionTypes: { type: [String], default: [] },
    maxFileSize: { type: String, maxlength: 50, default: "" },
    maxFiles: { type: Number, min: 1, max: 10, default: 1 },
    rubric: { type: Schema.Types.Mixed, default: [] },
  },
  opts,
);
export const Exam = mongoose.models.Exam || mongoose.model("Exam", examSchema);

const attemptSchema = new Schema(
  {
    studentId: { type: String, required: true, index: true },
    examId: { type: String, required: true, index: true },
    attemptNumber: { type: Number, required: true },
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    answers: { type: Schema.Types.Mixed, default: {} },
    state: {
      type: String,
      enum: ["in_progress", "submitted", "graded"],
      default: "in_progress",
    },
    score: { type: Number, default: null },
    feedback: { type: String, maxlength: 5000, default: "" },
    // Per-question / per-criterion grading detail (written + project feedback).
    breakdown: [
      {
        key: { type: String, maxlength: 100, default: "" },
        label: { type: String, maxlength: 200, default: "" },
        maxMarks: { type: Number, min: 0, max: 100000, default: 0 },
        marks: { type: Number, min: 0, max: 100000, default: 0 },
        comment: { type: String, maxlength: 5000, default: "" },
      },
    ],
  },
  opts,
);
attemptSchema.index(
  { studentId: 1, examId: 1, attemptNumber: 1 },
  { unique: true },
);
export const ExamAttempt =
  mongoose.models.ExamAttempt || mongoose.model("ExamAttempt", attemptSchema);

const commentSchema = new Schema(
  {
    authorId: { type: String, required: true, index: true },
    targetType: { type: String, enum: CONTENT_TYPES, required: true },
    targetId: { type: String, required: true, index: true },
    content: { type: String, required: true, maxlength: 2000 },
    moderationState: {
      type: String,
      enum: ["visible", "hidden", "flagged"],
      default: "visible",
    },
  },
  opts,
);
export const Comment =
  mongoose.models.Comment || mongoose.model("Comment", commentSchema);

const reactionSchema = new Schema(
  {
    authorId: { type: String, required: true },
    targetType: {
      type: String,
      enum: [...CONTENT_TYPES, "comment"],
      required: true,
    },
    targetId: { type: String, required: true },
    value: { type: String, enum: ["like", "dislike"], required: true },
  },
  opts,
);
reactionSchema.index(
  { authorId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
export const Reaction =
  mongoose.models.Reaction || mongoose.model("Reaction", reactionSchema);

// Saved content: one bookmark per user per content item.
const bookmarkSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    targetType: { type: String, enum: CONTENT_TYPES, required: true },
    targetId: { type: String, required: true },
  },
  opts,
);
bookmarkSchema.index(
  { userId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
export const Bookmark =
  mongoose.models.Bookmark || mongoose.model("Bookmark", bookmarkSchema);

const ratingSchema = new Schema(
  {
    authorId: { type: String, required: true },
    targetType: { type: String, enum: [...CONTENT_TYPES, "teacher"], required: true },
    targetId: { type: String, required: true },
    value: { type: Number, min: 1, max: 5, required: true },
  },
  opts,
);
ratingSchema.index(
  { authorId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
export const Rating =
  mongoose.models.Rating || mongoose.model("Rating", ratingSchema);

const followSchema = new Schema(
  {
    followerId: { type: String, required: true },
    teacherId: { type: String, required: true },
  },
  opts,
);
followSchema.index({ followerId: 1, teacherId: 1 }, { unique: true });
export const Follow =
  mongoose.models.Follow || mongoose.model("Follow", followSchema);

// Blocked teachers: one block per user per teacher.
const blockSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    teacherId: { type: String, required: true },
  },
  opts,
);
blockSchema.index({ userId: 1, teacherId: 1 }, { unique: true });
export const Block =
  mongoose.models.Block || mongoose.model("Block", blockSchema);

const purchaseSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    contentType: { type: String, enum: CONTENT_TYPES, required: true },
    contentId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, length: 3 },
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "failed",
        "cancelled",
        "expired",
        "risk_hold",
        "refunded",
      ],
      default: "pending",
      index: true,
    },
    tranId: { type: String, required: true, unique: true, index: true },
    gatewayTranId: { type: String, default: "", index: true },
    gatewaySessionId: { type: String, default: "" },
    valId: { type: String, default: "" },
    statusHistory: [
      { status: String, at: { type: Date, default: Date.now }, source: String },
    ],
  },
  opts,
);
export const Purchase =
  mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);

// Manual teacher payouts recorded by admins. A teacher's due payout is
// (paid sales of their content) minus the sum of these records.
const payoutSchema = new Schema(
  {
    teacherId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, length: 3, default: "USD" },
    note: { type: String, maxlength: 500, default: "" },
    createdBy: { type: String, required: true },
  },
  opts,
);
export const Payout =
  mongoose.models.Payout || mongoose.model("Payout", payoutSchema);

const paymentEventSchema = new Schema(
  {
    tranId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    provider: { type: String, default: "sslcommerz" },
    payloadHash: { type: String, required: true },
    processingState: {
      type: String,
      enum: ["received", "validated", "rejected", "duplicate"],
      default: "received",
    },
  },
  opts,
);
export const PaymentEvent =
  mongoose.models.PaymentEvent ||
  mongoose.model("PaymentEvent", paymentEventSchema);

const entitlementSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    contentType: { type: String, enum: CONTENT_TYPES, required: true },
    contentId: { type: String, required: true },
    sourcePurchaseId: { type: String, required: true },
    active: { type: Boolean, default: true, index: true },
    grantedAt: { type: Date, default: Date.now },
    revokedAt: Date,
    revokeReason: { type: String, maxlength: 500, default: "" },
  },
  opts,
);
entitlementSchema.index(
  { userId: 1, contentType: 1, contentId: 1, sourcePurchaseId: 1 },
  { unique: true },
);
export const Entitlement =
  mongoose.models.Entitlement ||
  mongoose.model("Entitlement", entitlementSchema);

const uploadSchema = new Schema(
  {
    ownerId: { type: String, required: true, index: true },
    storageKey: { type: String, required: true, unique: true },
    filename: { type: String, maxlength: 255, required: true },
    detectedMime: { type: String, required: true },
    size: { type: Number, required: true },
    checksum: { type: String, required: true },
    purpose: {
      type: String,
      enum: ["assignment", "content", "avatar", "cover"],
      required: true,
    },
    relatedId: { type: String, default: null },
    scanStatus: {
      type: String,
      enum: ["pending_scan", "clean", "suspicious", "infected", "scan_failed", "disabled"],
      default: "disabled",
      index: true,
    },
    scanId: { type: String, default: "" },
    scanProvider: { type: String, default: "" },
    scannedAt: { type: Date, default: null },
    scanErrorCode: { type: String, default: "" },
  },
  opts,
);
export const Upload =
  mongoose.models.Upload || mongoose.model("Upload", uploadSchema);

const auditSchema = new Schema(
  {
    actorId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, default: "" },
    resourceId: { type: String, default: "" },
    outcome: { type: String, enum: ["success", "failure"], default: "success" },
    reason: { type: String, maxlength: 500, default: "" },
    requestId: { type: String, default: "" },
  },
  opts,
);
export const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditSchema);

const reportSchema = new Schema(
  {
    reporterId: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    reason: { type: String, required: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
    resolution: { type: String, maxlength: 1000, default: "" },
  },
  opts,
);
reportSchema.index(
  { reporterId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
export const Report =
  mongoose.models.Report || mongoose.model("Report", reportSchema);

export type ProfileDoc = InferSchemaType<typeof profileSchema>;
