import type { ReactNode } from "react";
import { AppShell, RoleGuard, ADMIN_NAV } from "@/components/AppShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard role="admin">
      <AppShell nav={ADMIN_NAV} roleLabel="Administration">{children}</AppShell>
    </RoleGuard>
  );
}
