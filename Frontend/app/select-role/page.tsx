"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { Btn, Notice } from "@/components/ui";
import { apiPost, ApiError } from "@/lib/api";
import { useAuth, roleHome } from "@/lib/auth";

export default function SelectRolePage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/sign-in");
    if (!loading && user && (user.roleSelected || user.role === "admin")) router.replace(roleHome(user.role));
  }, [user, loading, router]);

  const choose = async (role: "student" | "teacher") => {
    setBusy(true); setError("");
    try {
      await apiPost("/api/v1/me/select-role", { role });
      const me = await refresh();
      router.replace(roleHome(me?.role ?? role));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const me = await refresh();
        router.replace(roleHome(me?.role));
      } else {
        setError(e instanceof ApiError ? e.message : "Could not save your role.");
      }
    } finally { setBusy(false); }
  };

  return (
    <AuthCard title="How will you use LearnTest?" sub="Choose once. This decides your workspace and cannot be switched from settings.">
      {error && <Notice tone="red">{error}</Notice>}
      <div className="mt-2 grid gap-3">
        <button disabled={busy} onClick={() => choose("student")} className="rounded-xl border border-line bg-card p-5 text-left hover:border-brand disabled:opacity-50">
          <span className="font-display text-lg font-bold">Student</span>
          <span className="mt-1 block text-sm text-muted">Discover questions, watch lessons, take exams, and submit assignments.</span>
        </button>
        <button disabled={busy} onClick={() => choose("teacher")} className="rounded-xl border border-line bg-card p-5 text-left hover:border-brand disabled:opacity-50">
          <span className="font-display text-lg font-bold">Teacher</span>
          <span className="mt-1 block text-sm text-muted">Publish videos and questions, create exams, and grade student work.</span>
        </button>
      </div>
      <Btn href="/sign-in" variant="ghost" className="mt-5 w-full">Back to sign in</Btn>
    </AuthCard>
  );
}
