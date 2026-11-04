"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiPost, ApiError } from "@/lib/api";
import { useAuth, roleHome } from "@/lib/auth";
import { Btn, Notice } from "@/components/ui";
import { ModalShell } from "@/components/AlertDialog";

interface RoleSelectModalProps {
  /** Whether the modal should be visible. */
  open: boolean;
  /** Called when the backdrop/close is clicked. Left to the parent; the modal
   *  only hides once a role is actually selected. */
  onClose: () => void;
}

/** Modal that appears once after login when the user has not picked a role
 *  yet (and is not an admin). Clicking a role saves it, refreshes the session
 *  and hides the modal — no redirect to a separate /select-role page. */
export function RoleSelectModal({ open, onClose }: RoleSelectModalProps) {
  const { refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = async (role: "student" | "teacher") => {
    setBusy(true);
    setError("");
    try {
      await apiPost("/api/v1/me/select-role", { role });
      // Small delay to ensure database write completes before refresh
      await new Promise(resolve => setTimeout(resolve, 200));
      // Refresh the auth context to get updated roleSelected value
      await refresh();
      // Additional delay to show the loading state for better UX
      await new Promise(resolve => setTimeout(resolve, 400));
      const dest = roleHome(role);  // Use the selected role directly
      // Use window.location instead of router.replace to force a full page reload
      // This ensures all cached session data is cleared
      window.location.href = dest;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Role already selected, refresh and redirect
        await refresh();
        window.location.href = roleHome(role);
      } else {
        setError(e instanceof ApiError ? e.message : "Could not save your role.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <ModalShell label="Select your role" onClose={onClose}>
      <div className="text-center">
        <h2 className="font-display text-lg font-bold">How will you use LearnTest?</h2>
        <p className="mt-1 text-sm text-muted">Choose once. This decides your workspace and cannot be switched from settings.</p>
        {error && <Notice tone="red">{error}</Notice>}
        {busy && (
          <Notice tone="blue">
            <div className="flex items-center justify-center gap-2">
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-[#1d6ce0] border-t-transparent" />
              <span>Setting up your workspace, please wait...</span>
            </div>
          </Notice>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            disabled={busy}
            onClick={() => choose("student")}
            className="rounded-xl border border-line bg-card p-5 text-left hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed card-hover transition-all"
          >
            <span className="font-display text-lg font-bold">Student</span>
            <span className="mt-1 block text-sm text-muted">Discover questions, watch lessons, take exams, and submit assignments.</span>
          </button>
          <button
            disabled={busy}
            onClick={() => choose("teacher")}
            className="rounded-xl border border-line bg-card p-5 text-left hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed card-hover transition-all"
          >
            <span className="font-display text-lg font-bold">Teacher</span>
            <span className="mt-1 block text-sm text-muted">Publish videos and questions, create exams, and grade student work.</span>
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
