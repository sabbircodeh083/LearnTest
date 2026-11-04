"use client";
import { useAuth } from "@/lib/auth";
import { RoleSelectModal } from "./RoleSelectModal";

/** Renders the role-selection modal exactly once after login: it is visible
 *  only while the user is signed in, has not picked a role yet, and is not an
 *  admin. Once a role is selected the session is refreshed and the modal hides
 *  automatically — it never shows again for users who already have a role. */
export function RoleSelector() {
  const { user, loading } = useAuth();
  const show = !loading && !!user && !user.roleSelected && user.role !== "admin";
  return <RoleSelectModal open={show} onClose={() => {}} />;
}
