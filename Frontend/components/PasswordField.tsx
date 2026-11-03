"use client";
import { useId, useState } from "react";
import { inputCls } from "@/components/ui";

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  error?: string;
  hint?: string;
};

/**
 * Password input with an accessible show/hide eye toggle.
 *
 * The toggle is a real button outside the label, so clicking it never
 * activates the label and it works with the keyboard and screen readers.
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  error,
  hint,
}: PasswordFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [show, setShow] = useState(false);

  return (
    <div className="block">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={inputCls}
          style={{ paddingRight: "3rem" }}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          title={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          {show ? (
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              className="h-[18px] w-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 3 18 18" />
              <path d="M10.6 5.7A10.8 10.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.8 17.8 0 0 1-3.4 4.3" />
              <path d="M6.2 6.7A17.7 17.7 0 0 0 2.5 12S6 18.5 12 18.5a10.6 10.6 0 0 0 4.5-1" />
              <path d="M9.8 9.8a3 3 0 0 0 4.4 4.4" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              className="h-[18px] w-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {hint && !error && (
        <span id={hintId} className="mt-1 block text-xs text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
