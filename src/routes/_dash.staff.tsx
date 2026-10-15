import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, History, KeyRound, MapPin } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { isUploadWithinLimit, PROFILE_PHOTO_MAX_BYTES, rolesApi, usersApi, type AdminUserDetails, type ApiUser, type Role, type UserActivity } from "@/lib/api";
import { LocationDisplay } from "@/components/location-display";
import { LocationPicker, type LocationPickerValue } from "@/components/location-picker";
import { PrivateDocumentUpload } from "@/components/private-document-upload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_dash/staff")({ component: StaffPage });

const blankStaff = { full_name: "", email: "", phone: "", password: "", role_id: "" };

function StaffPage() {
  const { can } = useAuth();
  const [staff, setStaff] = useState<ApiUser[]>([]);
  const [staffPhotoUrls, setStaffPhotoUrls] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ApiUser | null>(null);
  const [originalStaff, setOriginalStaff] = useState<ApiUser | null>(null);
  const [details, setDetails] = useState<AdminUserDetails | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [editing, setEditing] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showResetPasswords, setShowResetPasswords] = useState(false);
  const [form, setForm] = useState(blankStaff);
  const [editRoleId, setEditRoleId] = useState("");
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [users, allRoles] = await Promise.all([usersApi.list("staff"), rolesApi.list()]);
      setStaff(users);
      const photoEntries = await Promise.all(users.map(async (user) => {
        try { return [user.id, (await usersApi.staffPhotoUrl(user.id)).url] as const; }
        catch { return [user.id, ""] as const; }
      }));
      setStaffPhotoUrls(Object.fromEntries(photoEntries));
      setRoles(allRoles.filter((role) => role.is_active && !["customer", "cleaner"].includes(role.slug)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load staff."); }
  };
  useEffect(() => { void load(); }, []);

  const view = async (user: ApiUser) => {
    setSelected(user); setOriginalStaff(user); setEditRoleId(user.role.id); setDetails(null); setActivity(null); setEditing(false); setResettingPassword(false); setShowResetPasswords(false);
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
    try { const changes: Partial<Pick<ApiUser, "full_name" | "email" | "phone" | "city">> = {}; if (originalStaff) { (["full_name", "email", "phone", "city"] as const).forEach((field) => { if (selected[field] !== originalStaff[field]) changes[field] = selected[field] as never; }); } if (Object.keys(changes).length) await usersApi.update(selected.id, changes); if (editRoleId && editRoleId !== selected.role.id) await usersApi.assignRole(selected.id, editRoleId); setEditing(false); await view(selected); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update staff."); }
  };
  const resetPassword = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    if (passwordForm.newPassword.length < 10 || !/[A-Za-z]/.test(passwordForm.newPassword) || !/\d/.test(passwordForm.newPassword)) { setError("Password must be 10–128 characters and include at least one letter and one number."); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setError("The passwords do not match."); return; }
    try { await usersApi.setStaffPassword(selected.id, passwordForm.newPassword, passwordForm.confirmPassword); setPasswordForm({ newPassword: "", confirmPassword: "" }); setResettingPassword(false); setShowResetPasswords(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reset staff password."); }
  };
  const openActivity = async () => { if (!selected) return; try { setActivity(await usersApi.activity(selected.id)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load activity."); } };

  return <div className="space-y-6">
    <PageHeader title="Staff" description="Manage internal staff accounts, roles, contact details and activity." actions={can("users.create") ? <Button onClick={() => setCreateOpen(true)}>Create staff</Button> : undefined} />
    {error && <p className="text-sm text-destructive">{error}</p>}
    <Card className="p-4"><Table><TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Image</TableHead><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{staff.map((user, index) => { const initials = user.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(); return <TableRow key={user.id}><TableCell className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</TableCell><TableCell><Avatar className="size-10"><AvatarImage src={staffPhotoUrls[user.id] || undefined} alt={`${user.full_name} profile`} /><AvatarFallback className="bg-blue-100 text-xs font-semibold text-blue-950">{initials}</AvatarFallback></Avatar></TableCell><TableCell className="font-medium">{user.full_name}</TableCell><TableCell>{user.phone ?? "—"}</TableCell><TableCell>{user.email ?? "—"}</TableCell><TableCell><Badge variant={user.is_active ? "success" : "destructive"}>{user.is_active ? "Active" : "Inactive"}</Badge></TableCell><TableCell><Badge variant="secondary">{user.role.name}</Badge></TableCell><TableCell className="text-right"><Button size="sm" className="bg-blue-950 text-white hover:bg-blue-900" onClick={() => void view(user)}>View details</Button></TableCell></TableRow>; })}{!staff.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">No staff members found.</TableCell></TableRow>}</TableBody></Table></Card>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Create staff account</DialogTitle></DialogHeader><form className="grid gap-4" onSubmit={create}><Field label="Full name"><Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></Field><Field label="Phone (optional)"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field><Field label="Password"><Input type="password" minLength={10} maxLength={128} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></Field><p className="-mt-2 text-xs text-muted-foreground">Use 10–128 characters with at least one letter and one number.</p><Field label="Role"><Select value={form.role_id} onValueChange={(role_id) => setForm({ ...form, role_id })}><SelectTrigger><SelectValue placeholder="Choose a role" /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></Field><Button disabled={!form.role_id}>Create staff</Button></form></DialogContent></Dialog>

    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelected(null); setResettingPassword(false); setShowResetPasswords(false); } }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{resettingPassword ? "Reset staff password" : "Staff details"}</DialogTitle></DialogHeader>{selected && resettingPassword ? <form className="space-y-4" onSubmit={resetPassword}><p className="text-sm text-muted-foreground">This will revoke the staff member’s existing refresh sessions. They will need to sign in again with the new password.</p><Field label="New password"><PasswordInput value={passwordForm.newPassword} visible={showResetPasswords} onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })} onToggleVisibility={() => setShowResetPasswords(!showResetPasswords)} /></Field><Field label="Confirm new password"><PasswordInput value={passwordForm.confirmPassword} visible={showResetPasswords} onChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })} onToggleVisibility={() => setShowResetPasswords(!showResetPasswords)} /></Field><p className="text-xs text-muted-foreground">Use 10–128 characters with at least one letter and one number.</p><div className="flex gap-2"><Button>Set new password</Button><Button type="button" variant="outline" onClick={() => { setResettingPassword(false); setShowResetPasswords(false); }}>Cancel</Button></div></form> : selected && (editing ? <StaffEditTabs user={selected} roles={roles} editRoleId={editRoleId} setEditRoleId={setEditRoleId} onUserChange={setSelected} onSave={save} onPhotoUpdated={load} canUpload={can("users.update")} /> : <StaffDetails user={details?.user ?? selected} details={details} activity={activity} canUpload={can("users.update")} onPhotoUpdated={load} />)}{selected && !editing && !resettingPassword && <div className="flex flex-wrap gap-2 border-t pt-4"><Button className="bg-blue-950 text-white hover:bg-blue-900" onClick={() => setEditing(true)} disabled={!can("users.update")}>Edit staff</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => { setShowResetPasswords(false); setResettingPassword(true); }} disabled={!can("users.update")}><KeyRound className="mr-2 size-4" />Reset password</Button><Button variant="outline" className="border-blue-950 text-blue-950 hover:bg-blue-50 hover:text-blue-950" onClick={() => void openActivity()} disabled={!can("audit_logs.read")}><History className="mr-2 size-4" />Activity</Button>{can("users.suspend") && <Button variant={selected.is_active ? "destructive" : "default"} className={!selected.is_active ? "bg-emerald-600 text-white hover:bg-emerald-700" : undefined} onClick={async () => { try { await usersApi.setStaffStatus(selected.id, !selected.is_active); await view(selected); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update staff status."); } }}>{selected.is_active ? "Deactivate" : "Activate"}</Button>}</div>}</DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>; }
function PasswordInput({ value, visible, onChange, onToggleVisibility }: { value: string; visible: boolean; onChange: (value: string) => void; onToggleVisibility: () => void }) { return <div className="relative"><Input type={visible ? "text" : "password"} className="pr-10" minLength={10} maxLength={128} value={value} onChange={(event) => onChange(event.target.value)} required /><button type="button" className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onToggleVisibility} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>; }
function StaffEditTabs({ user, roles, editRoleId, setEditRoleId, onUserChange, onSave, onPhotoUpdated, canUpload }: { user: ApiUser; roles: Role[]; editRoleId: string; setEditRoleId: (id: string) => void; onUserChange: (user: ApiUser) => void; onSave: (event: FormEvent) => void; onPhotoUpdated: () => Promise<void>; canUpload: boolean }) {
  return <Tabs defaultValue="personal" className="space-y-4">
    <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="personal">Personal details</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger></TabsList>
    <TabsContent value="personal" className="space-y-4">
      <form className="space-y-4" onSubmit={onSave}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={user.full_name} onChange={(event) => onUserChange({ ...user, full_name: event.target.value })} /></Field>
          <Field label="Email"><Input value={user.email ?? ""} onChange={(event) => onUserChange({ ...user, email: event.target.value })} /></Field>
          <Field label="Phone"><Input value={user.phone ?? ""} onChange={(event) => onUserChange({ ...user, phone: event.target.value })} /></Field>
          <Field label="Role"><Select value={editRoleId} onValueChange={setEditRoleId}><SelectTrigger><SelectValue placeholder="Choose a role" /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent></Select></Field>
        </div>
        <LocationPicker latitude={user.residency_latitude} longitude={user.residency_longitude} city={user.city} onChange={(val: LocationPickerValue) => onUserChange({ ...user, residency_latitude: val.latitude, residency_longitude: val.longitude, city: val.city || user.city })} label="Staff Location & Base Map" placeholder="Search staff location…" />
        <div className="flex justify-end"><Button disabled={!canUpload}>Save personal details</Button></div>
      </form>
    </TabsContent>
    <TabsContent value="documents" className="space-y-5">
      <StaffPhotoEditor user={user} canUpload={canUpload} onPhotoUpdated={onPhotoUpdated} />
      <section className="space-y-3"><div><h3 className="font-medium">Staff documents</h3><p className="text-xs text-muted-foreground">Private reference form and contract.</p></div><div className="grid gap-3 sm:grid-cols-2">{([ ["reference-form", "Reference form", user.has_reference_form], ["contract", "Contract", user.has_contract] ] as const).map(([type, title, uploaded]) => <PrivateDocumentUpload key={`${user.id}-${type}`} title={title} uploaded={uploaded} canUpload={canUpload} onUpload={(file) => usersApi.uploadStaffDocument(user.id, type, file)} loadPreview={() => usersApi.getStaffDocumentPreview(user.id, type)} onView={() => usersApi.viewStaffDocument(user.id, type)} />)}</div></section>
      <section className="space-y-3"><div><h3 className="font-medium">Staff KYC documents</h3><p className="text-xs text-muted-foreground">Identity, KRA, and Certificate of Good Conduct files are private.</p></div><div className="grid gap-3 sm:grid-cols-2">{([ ["identity", "National ID or Birth Certificate", user.has_identity_document], ["kra", "KRA document", user.has_kra_document], ["good-conduct", "Certificate of Good Conduct", user.has_good_conduct_document] ] as const).map(([type, title, uploaded]) => <PrivateDocumentUpload key={`${user.id}-${type}`} title={title} uploaded={uploaded} canUpload={canUpload} onUpload={(file) => usersApi.uploadStaffKycDocument(user.id, type, file)} loadPreview={() => usersApi.getStaffKycDocumentPreview(user.id, type)} onView={() => usersApi.viewStaffKycDocument(user.id, type)} />)}</div></section>
    </TabsContent>
  </Tabs>;
}
function StaffDetails({ user, details, activity, canUpload, onPhotoUpdated }: { user: ApiUser; details: AdminUserDetails | null; activity: UserActivity | null; canUpload: boolean; onPhotoUpdated: () => Promise<void> }) {
  return <Tabs defaultValue="personal" className="space-y-4">
    <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="personal">Personal details</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger></TabsList>
    <TabsContent value="personal" className="space-y-4">
      <StaffPhotoEditor user={user} canUpload={canUpload} onPhotoUpdated={onPhotoUpdated} />
      <div className="grid grid-cols-2 gap-3 text-sm">{[["Full name", user.full_name], ["Email", user.email], ["Phone", user.phone], ["Role", user.role.name], ["Last login", user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "—"], ["Permissions", `${user.permissions.length} effective permissions`]].map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>)}</div>
      <div className="rounded-lg border p-3"><p className="flex gap-2 text-sm font-medium"><MapPin className="size-4 text-blue-900" />Location</p><p className="mt-1 text-sm font-medium"><LocationDisplay lat={user.residency_latitude} lng={user.residency_longitude} city={user.city} fallback="Location not provided" /></p></div>
      {details && <div className="grid grid-cols-2 gap-2 text-sm"><Count label="Active bookings" value={details.active_bookings.length} /><Count label="Past bookings" value={details.past_bookings.length} /><Count label="Active subscriptions" value={details.active_subscriptions.length} /><Count label="Past subscriptions" value={details.past_subscriptions.length} /></div>}
      {activity && <div className="max-h-40 divide-y overflow-y-auto rounded-md border">{activity.events.length ? activity.events.map((event) => <div key={event.id} className="p-2 text-sm">{event.action}<span className="ml-2 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span></div>) : <p className="p-2 text-sm text-muted-foreground">No recorded activity.</p>}</div>}
    </TabsContent>
    <TabsContent value="documents" className="space-y-5">
      <section className="space-y-3"><div><h3 className="font-medium">Staff documents</h3><p className="text-xs text-muted-foreground">Private reference form and contract.</p></div><div className="grid gap-3 sm:grid-cols-2">{([ ["reference-form", "Reference form", user.has_reference_form], ["contract", "Contract", user.has_contract] ] as const).map(([type, title, uploaded]) => <PrivateDocumentUpload key={`${user.id}-${type}`} title={title} uploaded={uploaded} canUpload={canUpload} onUpload={(file) => usersApi.uploadStaffDocument(user.id, type, file)} loadPreview={() => usersApi.getStaffDocumentPreview(user.id, type)} onView={() => usersApi.viewStaffDocument(user.id, type)} />)}</div></section>
      <section className="space-y-3"><div><h3 className="font-medium">Staff KYC documents</h3><p className="text-xs text-muted-foreground">Identity, KRA, and Certificate of Good Conduct files are private.</p></div><div className="grid gap-3 sm:grid-cols-2">{([ ["identity", "National ID or Birth Certificate", user.has_identity_document], ["kra", "KRA document", user.has_kra_document], ["good-conduct", "Certificate of Good Conduct", user.has_good_conduct_document] ] as const).map(([type, title, uploaded]) => <PrivateDocumentUpload key={`${user.id}-${type}`} title={title} uploaded={uploaded} canUpload={canUpload} onUpload={(file) => usersApi.uploadStaffKycDocument(user.id, type, file)} loadPreview={() => usersApi.getStaffKycDocumentPreview(user.id, type)} onView={() => usersApi.viewStaffKycDocument(user.id, type)} />)}</div></section>
    </TabsContent>
  </Tabs>;
}

function StaffPhotoEditor({ user, canUpload, onPhotoUpdated }: { user: ApiUser; canUpload: boolean; onPhotoUpdated: () => Promise<void> }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initials = user.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    let active = true;
    void usersApi.staffPhotoUrl(user.id).then(({ url }) => { if (active) setPhotoUrl(url); }).catch(() => { if (active) setPhotoUrl(null); });
    return () => { active = false; };
  }, [user.id]);
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const upload = async () => {
    if (!file) return;
    try {
      setBusy(true); setError(null);
      await usersApi.uploadStaffPhoto(user.id, file);
      setFile(null);
      setPhotoUrl((await usersApi.staffPhotoUrl(user.id)).url);
      await onPhotoUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the staff image.");
    } finally { setBusy(false); }
  };

  return <section className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
    <Avatar className="size-16"><AvatarImage src={previewUrl ?? photoUrl ?? undefined} alt={`${user.full_name} profile`} /><AvatarFallback className="bg-blue-100 font-semibold text-blue-950">{initials}</AvatarFallback></Avatar>
    <div className="min-w-48 flex-1"><h3 className="font-medium">Staff profile image</h3><p className="text-xs text-muted-foreground">JPEG, PNG, or WebP; up to 5 MB.</p>{file && <p className="mt-1 text-xs">Selected: {file.name}</p>}{error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}</div>
    {canUpload && <div className="flex flex-wrap items-center gap-2"><Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (selected && !isUploadWithinLimit(selected, PROFILE_PHOTO_MAX_BYTES, "Profile photo")) { event.currentTarget.value = ""; setFile(null); return; } setError(null); setFile(selected); }} /><Button type="button" size="sm" disabled={!file || busy} onClick={() => void upload()}>{busy ? "Uploading…" : "Replace image"}</Button></div>}
  </section>;
}
function Count({ label, value }: { label: string; value: number }) { return <div className="rounded bg-muted p-2"><p className="text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>; }
