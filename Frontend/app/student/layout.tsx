import type { ReactNode } from "react";
import { AppShell, RoleGuard, STUDENT_NAV } from "@/components/AppShell";
import { SavedProvider } from "@/lib/saved";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="student">
      <AppShell nav={STUDENT_NAV} roleLabel="Student">
        <SavedProvider>{children}</SavedProvider>
      </AppShell>
    </RoleGuard>
  );
}
