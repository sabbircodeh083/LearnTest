"use client";
import Link from "next/link";
import { useAuth, roleHome } from "@/lib/auth";
import { Logo } from "./AppShell";
import { Btn } from "./ui";

export function PublicHeader() {
  const { user, loading } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Logo />
        <nav aria-label="Public" className="ml-4 hidden items-center gap-4 text-sm font-medium md:flex">
          <Link href="/#videos" className="hover:text-brandstrong">Videos</Link>
          <Link href="/#tests" className="hover:text-brandstrong">Tests</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {!loading && user ? (
            <Btn href={roleHome(user.role)}>Open my dashboard</Btn>
          ) : (
            <>
              <Link href="/sign-in" className="rounded-lg border border-line bg-card px-5 py-2 text-sm font-semibold hover:bg-soft">Log in</Link>
              <Link href="/sign-up" className="rounded-lg bg-[#16a34a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#15803d]">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
