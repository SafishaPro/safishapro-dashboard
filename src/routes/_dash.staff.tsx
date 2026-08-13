import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { History, KeyRound, MapPin } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { rolesApi, usersApi, type AdminUserDetails, type ApiUser, type Role, type UserActivity } from "@/lib/api";

export const Route = createFileRoute("/_dash/staff")({ component: StaffPage });

const blankStaff = { full_name: "", email: "", phone: "", password: "", role_id: "" };

function StaffPage() {
  const { can } = useAuth();
  const [staff, setStaff] = useState<ApiUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ApiUser | null>(null);
  const [details, setDetails] = useState<AdminUserDetails | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [editing, setEditing] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [form, setForm] = useState(blankStaff);
  const [editRoleId, setEditRoleId] = useState("");
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [users, allRoles] = await Promise.all([usersApi.list("staff"), rolesApi.list()]);
      setStaff(users);
      setRoles(allRoles.filter((role) => role.is_active && !["customer", "cleaner"].includes(role.slug)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load staff."); }
  };
  useEffect(() => { void load(); }, []);

  const view = async (user: ApiUser) => {
    setSelected(user); setEditRoleId(user.role.id); setDetails(null); setActivity(null); setEditing(false); setResettingPassword(false);
    try { setDetails(await usersApi.get(user.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load staff details."); }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password.length < 10 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) { setError("Password must be 10–128 characters and include at least one letter and one number."); return; }
    try { await usersApi.createStaff({ ...form, phone: form.phone || undefined }); setCreateOpen(false); setForm(blankStaff); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create staff."); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    try { await usersApi.update(selected.id, { full_name: selected.full_name, email: selected.email ?? undefined, phone: selected.phone ?? undefined, city: selected.city ?? undefined }); if (editRoleId && editRoleId !== selected.role.id) await usersApi.assignRole(selected.id, editRoleId); setEditing(false); await view(selected); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update staff."); }
  };
  const resetPassword = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    if (passwordForm.newPassword.length < 10 || !/[A-Za-z]/.test(passwordForm.newPassword) || !/\d/.test(passwordForm.newPassword)) { setError("Password must be 10–128 characters and include at least one letter and one number."); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setError("The passwords do not match."); return; }
    try { await usersApi.setStaffPassword(selected.id, passwordForm.newPassword, passwordForm.confirmPassword); setPasswordForm({ newPassword: "", confirmPassword: "" }); setResettingPassword(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reset staff password."); }
  };
  const openActivity = async () => { if (!selected) return; try { setActivity(await usersApi.activity(selected.id)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load activity."); } };

  return <div className="space-y-6">
    <PageHeader title="Staff" description="Manage internal staff accounts, roles, contact details and activity." actions={can("users.create") ? <Button onClick={() => setCreateOpen(true)}>Create staff</Button> : undefined} />
    {error && <p className="text-sm text-destructive">{error}</p>}
    <Card className="p-4"><Table><TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{staff.map((user, index) => <TableRow key={user.id}><TableCell className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</TableCell><TableCell className="font-medium">{user.full_name}</TableCell><TableCell>{user.phone ?? "—"}</TableCell><TableCell>{user.email ?? "—"}</TableCell><TableCell><Badge variant={user.is_active ? "success" : "destructive"}>{user.is_active ? "Active" : "Inactive"}</Badge></TableCell><TableCell><Badge variant="secondary">{user.role.name}</Badge></TableCell><TableCell className="text-right"><Button size="sm" className="bg-blue-950 text-white hover:bg-blue-900" onClick={() => void view(user)}>View details</Button></TableCell></TableRow>)}{!staff.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">No staff members found.</TableCell></TableRow>}</TableBody></Table></Card>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Create staff account</DialogTitle></DialogHeader><form className="grid gap-4" onSubmit={create}><Field label="Full name"><Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></Field><Field label="Phone (optional)"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field><Field label="Password"><Input type="password" minLength={10} maxLength={128} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></Field><p className="-mt-2 text-xs text-muted-foreground">Use 10–128 characters with at least one letter and one number.</p><Field label="Role"><Select value={form.role_id} onValueChange={(role_id) => setForm({ ...form, role_id })}><SelectTrigger><SelectValue placeholder="Choose a role" /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></Field><Button disabled={!form.role_id}>Create staff</Button></form></DialogContent></Dialog>

    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelected(null); setResettingPassword(false); } }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{resettingPassword ? "Reset staff password" : "Staff details"}</DialogTitle></DialogHeader>{selected && resettingPassword ? <form className="space-y-4" onSubmit={resetPassword}><p className="text-sm text-muted-foreground">This will revoke the staff member’s existing refresh sessions. They will need to sign in again with the new password.</p><Field label="New password"><Input type="password" minLength={10} maxLength={128} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required /></Field><Field label="Confirm new password"><Input type="password" minLength={10} maxLength={128} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} required /></Field><p className="text-xs text-muted-foreground">Use 10–128 characters with at least one letter and one number.</p><div className="flex gap-2"><Button>Set new password</Button><Button type="button" variant="outline" onClick={() => setResettingPassword(false)}>Cancel</Button></div></form> : selected && (editing ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}><Field label="Full name"><Input value={selected.full_name} onChange={(event) => setSelected({ ...selected, full_name: event.target.value })} /></Field><Field label="Email"><Input value={selected.email ?? ""} onChange={(event) => setSelected({ ...selected, email: event.target.value })} /></Field><Field label="Phone"><Input value={selected.phone ?? ""} onChange={(event) => setSelected({ ...selected, phone: event.target.value })} /></Field><Field label="City"><Input value={selected.city ?? ""} onChange={(event) => setSelected({ ...selected, city: event.target.value })} /></Field><Field label="Role"><Select value={editRoleId} onValueChange={setEditRoleId}><SelectTrigger><SelectValue placeholder="Choose a role" /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></Field><div className="flex items-end"><Button disabled={!can("users.update")}>Save changes</Button></div></form> : <StaffDetails user={details?.user ?? selected} details={details} activity={activity} />)}{selected && !editing && !resettingPassword && <div className="flex flex-wrap gap-2 border-t pt-4"><Button className="bg-blue-950 text-white hover:bg-blue-900" onClick={() => setEditing(true)} disabled={!can("users.update")}>Edit staff</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setResettingPassword(true)} disabled={!can("users.update")}><KeyRound className="mr-2 size-4" />Reset password</Button><Button variant="outline" className="border-blue-950 text-blue-950 hover:bg-blue-50 hover:text-blue-950" onClick={() => void openActivity()} disabled={!can("audit_logs.read")}><History className="mr-2 size-4" />Activity</Button>{can("users.suspend") && <Button variant={selected.is_active ? "destructive" : "default"} className={!selected.is_active ? "bg-emerald-600 text-white hover:bg-emerald-700" : undefined} onClick={async () => { try { await usersApi.setStaffStatus(selected.id, !selected.is_active); await view(selected); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update staff status."); } }}>{selected.is_active ? "Deactivate" : "Activate"}</Button>}</div>}</DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>; }
function StaffDetails({ user, details, activity }: { user: ApiUser; details: AdminUserDetails | null; activity: UserActivity | null }) { const address = [user.address_description, user.city].filter(Boolean).join(", "); return <div className="space-y-4"><div className="grid grid-cols-2 gap-3 text-sm">{[["Full name", user.full_name], ["Email", user.email], ["Phone", user.phone], ["Role", user.role.name], ["Last login", user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "—"], ["Permissions", `${user.permissions.length} effective permissions`]].map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>)}</div><div className="rounded-lg border p-3"><p className="flex gap-2 text-sm font-medium"><MapPin className="size-4 text-blue-900" />Location</p><p className="text-sm text-muted-foreground">{address || "Address not provided"}</p></div>{details && <div className="grid grid-cols-2 gap-2 text-sm"><Count label="Active bookings" value={details.active_bookings.length} /><Count label="Past bookings" value={details.past_bookings.length} /><Count label="Active subscriptions" value={details.active_subscriptions.length} /><Count label="Past subscriptions" value={details.past_subscriptions.length} /></div>}{activity && <div className="max-h-40 divide-y overflow-y-auto rounded-md border">{activity.events.length ? activity.events.map((event) => <div key={event.id} className="p-2 text-sm">{event.action}<span className="ml-2 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span></div>) : <p className="p-2 text-sm text-muted-foreground">No recorded activity.</p>}</div>}</div>; }
function Count({ label, value }: { label: string; value: number }) { return <div className="rounded bg-muted p-2"><p className="text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>; }
