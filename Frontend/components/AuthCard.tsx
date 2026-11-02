"use client";
import type { ReactNode } from "react";
import { Logo, ThemeToggle } from "./AppShell";

export function AuthCard({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-soft">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{sub}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
