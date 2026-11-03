"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Btn, inputCls } from "./ui";

/** Shared modal shell — the same visual language as the rating dialog:
 *  dimmed blurred backdrop, centered rounded card, soft entrance animation. */
export function ModalShell({ label, onClose, children, maxWidth = "max-w-md" }: {
  label: string; onClose: () => void; children: ReactNode; maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label="Close" className="animate-fade-in absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`animate-modal-in relative max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-2xl`}>
        {children}
      </div>
    </div>
  );
}

function ToneIcon({ tone }: { tone: "danger" | "brand" | "info" }) {
  const cls = tone === "danger" ? "bg-dangersoft text-danger" : tone === "brand" ? "bg-brandsoft text-brandstrong" : "bg-infosoft text-[#1d6ce0]";
  return (
    <span aria-hidden className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${cls}`}>
      {tone === "danger" ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v5M12 16.5v.01" /><path d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" /></svg>
      ) : tone === "brand" ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 7.5v.01" /></svg>
      )}
    </span>
  );
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
export interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  minLength?: number;
  maxLength?: number;
  danger?: boolean;
}

interface DialogApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  promptReason: (opts: PromptOptions) => Promise<string | null>;
}

const DialogCtx = createContext<DialogApi>({ confirm: async () => false, promptReason: async () => null });
export const useDialog = () => useContext(DialogCtx);

type Active =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void };

/** Promise-based confirm/prompt dialogs in the rating-modal style.
 *  Replaces window.confirm / window.prompt everywhere in the app. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const activeRef = useRef<Active | null>(null);
  activeRef.current = active;

  const close = useCallback((value: boolean | string | null) => {
    const a = activeRef.current;
    setActive(null);
    setText("");
    setError("");
    if (!a) return;
    if (a.kind === "confirm") a.resolve(Boolean(value));
    else a.resolve(typeof value === "string" ? value : null);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setActive({ kind: "confirm", opts, resolve });
  }), []);
  const promptReason = useCallback((opts: PromptOptions) => new Promise<string | null>((resolve) => {
    setText("");
    setError("");
    setActive({ kind: "prompt", opts, resolve });
  }), []);

  const submitPrompt = () => {
    if (!active || active.kind !== "prompt") return;
    const min = active.opts.minLength ?? 3;
    const max = active.opts.maxLength ?? 1000;
    const value = text.trim();
    if (value.length < min) { setError(`Please enter at least ${min} characters (you entered ${value.length}).`); return; }
    if (value.length > max) { setError(`Please keep it to ${max} characters or less (you entered ${value.length}).`); return; }
    close(value);
  };

  return (
    <DialogCtx.Provider value={{ confirm, promptReason }}>
      {children}
      {active?.kind === "confirm" && (
        <ModalShell label={active.opts.title} onClose={() => close(false)}>
          <div className="text-center">
            <ToneIcon tone={active.opts.danger ? "danger" : "info"} />
            <h2 className="mt-3 text-lg font-bold">{active.opts.title}</h2>
            {active.opts.message && <p className="mt-1 text-sm text-muted">{active.opts.message}</p>}
            <div className="mt-6 flex justify-center gap-2">
              <Btn variant="ghost" onClick={() => close(false)}>{active.opts.cancelLabel ?? "Cancel"}</Btn>
              <Btn variant={active.opts.danger ? "danger" : "primary"} onClick={() => close(true)}>{active.opts.confirmLabel ?? "Confirm"}</Btn>
            </div>
          </div>
        </ModalShell>
      )}
      {active?.kind === "prompt" && (
        <ModalShell label={active.opts.title} onClose={() => close(null)}>
          <div className="text-center">
            <ToneIcon tone={active.opts.danger ? "danger" : "info"} />
            <h2 className="mt-3 text-lg font-bold">{active.opts.title}</h2>
            {active.opts.message && <p className="mt-1 text-sm text-muted">{active.opts.message}</p>}
          </div>
          <form className="mt-4" onSubmit={(e) => { e.preventDefault(); submitPrompt(); }}>
            <label className="block text-left">
              <span className="mb-1.5 block text-sm font-medium">{active.opts.label ?? "Reason"}</span>
              <textarea rows={3} autoFocus value={text} onChange={(e) => { setText(e.target.value); setError(""); }}
                placeholder={active.opts.placeholder ?? "Type here…"} className={inputCls} />
            </label>
            {error && <p role="alert" className="mt-2 text-xs font-medium text-danger">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => close(null)}>Cancel</Btn>
              <Btn type="submit" variant={active.opts.danger ? "danger" : "primary"}>{active.opts.confirmLabel ?? "Submit"}</Btn>
            </div>
          </form>
        </ModalShell>
      )}
    </DialogCtx.Provider>
  );
}
