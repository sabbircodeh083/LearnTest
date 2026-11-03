"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, Btn, Empty, ErrorBox, inputCls, Loading, PageHead, statusTone, useToast } from "@/components/ui";
import { useDialog } from "@/components/AlertDialog";
import { DataList, DataRow, RowIcon } from "@/components/DataList";
import { apiGet, apiPatch, ApiError, qs } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { fmtDate, type Page } from "@/lib/types";

interface AdminUser { userId: string; email: string; name: string; role: string; roleSelected: boolean; status: string; bio: string; createdAt: string }

function UsersInner() {
  const params = useSearchParams();
  const toast = useToast();
  const { promptReason } = useDialog();
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [role, setRole] = useState(params.get("role") ?? "");
  const [page, setPage] = useState(1);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const limit = 15;
  const { data, error, loading, retry } = useFetch(
    () => apiGet<Page<AdminUser>>(`/api/v1/admin/users${qs({ search: submitted, role, page, limit })}`), [submitted, role, page]);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  const changeRole = async (u: AdminUser) => {
    const next = u.role === "student" ? "teacher" : "student";
    const reason = await promptReason({ title: `Change ${u.email} to ${next}?`, label: "Reason (required, at least 3 characters)", confirmLabel: "Change role" });
    if (!reason) return;
    try { await apiPatch(`/api/v1/admin/users/${u.userId}/role`, { role: next, reason }); toast("Role updated."); retry(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not change role.", "err"); }
  };
  const toggleStatus = async (u: AdminUser) => {
    const next = u.status === "active" ? "suspended" : "active";
    const reason = await promptReason({ title: `${next === "suspended" ? "Suspend" : "Reactivate"} ${u.email}?`, label: "Reason (required, at least 3 characters)", confirmLabel: next === "suspended" ? "Suspend" : "Reactivate", danger: next === "suspended" });
    if (!reason) return;
    try { await apiPatch(`/api/v1/admin/users/${u.userId}/status`, { status: next, reason }); toast("Status updated."); retry(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not update status.", "err"); }
  };

  return (
    <div>
      <PageHead title="Users" sub="Change a student ↔ teacher role or suspend an account. Every change needs a reason and is audit-logged. This screen can never create an admin." />
      <div className="mb-5 flex flex-wrap gap-2">
        <form role="search" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setSubmitted(search.trim()); }}>
          <label className="sr-only" htmlFor="admin-user-search">Search users</label>
          <input id="admin-user-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className={inputCls} />
          <Btn type="submit">Search</Btn>
        </form>
        <label className="flex items-center gap-2 text-sm">Role
          <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className={inputCls}>
            <option value="">All roles</option><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
          </select>
        </label>
      </div>
      {loading ? <Loading label="Loading users…" /> : error ? <ErrorBox message={error} onRetry={retry} /> :
        !data?.items.length ? <Empty title="No users found" body="No accounts match this filter." /> : (
          <>
            <DataList label="Users">
              {data.items.map((u) => (
                <DataRow
                  key={u.userId}
                  icon={
                    <RowIcon tone="bg-soft text-muted">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
                    </RowIcon>
                  }
                  title={u.name || u.email}
                  meta={<>Joined {fmtDate(u.createdAt)} · <Badge tone={statusTone(u.status)}>{u.status}</Badge></>}
                  detail={u.name ? u.email : null}
                  chip={<span className="inline-flex rounded-md bg-soft px-2.5 py-1 text-xs font-bold capitalize text-muted">{u.role}</span>}
                  actions={
                        <div className="relative inline-block text-left">
                          <button type="button" aria-label={`Actions for ${u.name || u.email}`} aria-expanded={menuId === u.userId} aria-haspopup="menu"
                            onClick={(e) => {
                              if (menuId === u.userId) { setMenuId(null); return; }
                              // Fixed positioning escapes the table's scroll container, and the
                              // menu flips upward when there is no room below (last rows).
                              const r = e.currentTarget.getBoundingClientRect();
                              const up = window.innerHeight - r.bottom < 190;
                              setMenuPos(up
                                ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right }
                                : { top: r.bottom + 4, right: window.innerWidth - r.right });
                              setMenuId(u.userId);
                            }}
                            className="rounded-lg p-2 text-muted hover:bg-soft">⋮</button>
                          {menuId === u.userId && (
                            <>
                              <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuId(null)} />
                              <div role="menu" aria-label={`Actions for ${u.name || u.email}`} style={menuPos ?? undefined}
                                className="fixed right-0 z-20 mt-1 w-48 rounded-xl border border-line bg-card py-1.5 shadow-lg">
                                <Link role="menuitem" href={`/admin/users/${u.userId}`} onClick={() => setMenuId(null)}
                                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-soft">
                                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
                                  Profile
                                </Link>
                                {u.role !== "admin" && (
                                  <button type="button" role="menuitem" onClick={() => { setMenuId(null); void changeRole(u); }}
                                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-soft">
                                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                                    Make {u.role === "student" ? "teacher" : "student"}
                                  </button>
                                )}
                                <button type="button" role="menuitem" onClick={() => { setMenuId(null); void toggleStatus(u); }}
                                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-soft ${u.status === "active" ? "text-danger" : "text-[#16a34a]"}`}>
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d={u.status === "active" ? "M8 8l8 8M16 8l-8 8" : "m8.5 12.2 2.4 2.4 4.6-5"} /></svg>
                                  {u.status === "active" ? "Suspend" : "Reactivate"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                  }
                />
              ))}
            </DataList>
            <div className="mt-5 flex items-center gap-3">
              <Btn variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn>
              <span className="text-sm text-muted">Page {page} of {pages} · {data.total} users</span>
              <Btn variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
            </div>
          </>
        )}
    </div>
  );
}

export default function AdminUsersPage() {
  return <Suspense fallback={<Loading label="Loading users…" />}><UsersInner /></Suspense>;
}
