import type { ReactNode } from "react";
import { AppShell, RoleGuard, TEACHER_NAV } from "@/components/AppShell";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="teacher">
      <AppShell nav={TEACHER_NAV} roleLabel="Teacher Studio">{children}</AppShell>
    </RoleGuard>
  );
}
