import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authApi, isUploadWithinLimit, PROFILE_PHOTO_MAX_BYTES, usersApi, type ApiUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PrivateDocumentUpload } from "@/components/private-document-upload";

export const Route = createFileRoute("/_dash/profile")({ component: ProfilePage });

type ProfileForm = { full_name: string; username: string; email: string; gender: string; nationality: string; city: string; address_description: string; date_of_birth: string; preferred_language: string; password: string; residency_latitude: string; residency_longitude: string };
const toForm = (user: ApiUser): ProfileForm => ({ full_name: user.full_name ?? "", username: user.username ?? "", email: user.email ?? "", gender: (user.gender ?? "").toLowerCase().replaceAll("-", "_").replaceAll(" ", "_"), nationality: user.nationality ?? "", city: user.city ?? "", address_description: user.address_description ?? "", date_of_birth: user.date_of_birth ?? "", preferred_language: user.preferred_language ?? "", password: "", residency_latitude: user.residency_latitude?.toString() ?? "", residency_longitude: user.residency_longitude?.toString() ?? "" });
const latestAllowedDateOfBirth = () => { const date = new Date(); date.setFullYear(date.getFullYear() - 15); return date.toISOString().slice(0, 10); };
const formatAccountDateTime = (value: string | null) => {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")} ${part("month")} ${part("year")} ${part("hour")}:${part("minute")} ${part("dayPeriod").toUpperCase()}`;
};

function ProfilePage() {
  const { refreshAccess } = useAuth();
  const [profile, setProfile] = useState<ApiUser | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAdminDocuments, setShowAdminDocuments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = async () => { try { setError(null); const user = await authApi.me(); setProfile(user); setForm(toForm(user)); void usersApi.myProfilePhotoUrl().then(({ url }) => setProfilePhotoUrl(url)).catch(() => setProfilePhotoUrl(null)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your profile."); } };
  useEffect(() => { load(); }, []);
  const dirty = useMemo(() => Boolean(profile && form && JSON.stringify(toForm(profile)) !== JSON.stringify(form)), [profile, form]);
  const update = async () => {
    if (!profile || !form) return;
    if (form.date_of_birth && form.date_of_birth > latestAllowedDateOfBirth()) { setError("You must be at least 15 years old to set a date of birth."); return; }
    if ((form.residency_latitude && !form.residency_longitude) || (!form.residency_latitude && form.residency_longitude)) { setError("Enter both latitude and longitude, or leave both empty."); return; }
    const original = toForm(profile);
    const changes: Record<string, string | number | undefined> = {};
    (["full_name", "username", "email", "gender", "nationality", "city", "address_description", "date_of_birth", "preferred_language"] as const).forEach((field) => { if (form[field] !== original[field]) changes[field] = form[field] || undefined; });
    if (form.password) changes.password = form.password;
    if (form.residency_latitude !== original.residency_latitude || form.residency_longitude !== original.residency_longitude) { changes.residency_latitude = Number(form.residency_latitude); changes.residency_longitude = Number(form.residency_longitude); }
    try { setSaving(true); setError(null); const updated = await usersApi.updateMyProfile(changes); setProfile(updated); setForm(toForm(updated)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update your profile."); } finally { setSaving(false); }
  };
  const uploadPhoto = async () => {
    if (!photoFile) return;
    try {
      setUploadingPhoto(true);
      setError(null);
      const updated = await usersApi.uploadMyProfilePhoto(photoFile);
      setProfile(updated);
      setPhotoFile(null);
      const { url } = await usersApi.myProfilePhotoUrl();
      setProfilePhotoUrl(url);
      await refreshAccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload your profile photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };
  if (!profile || !form) return <div className="text-sm text-muted-foreground">Loading your profile…</div>;
  const initials = profile.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const isAdmin = profile.role.slug.toLowerCase().includes("admin");
  const editable = true;
  return <div className="space-y-6"><PageHeader title="My Profile" description="Keep your contact and location details accurate." actions={<>
      <Button variant="outline" onClick={load}>Refresh</Button>
      {isAdmin && <Button variant={showAdminDocuments ? "secondary" : "default"} aria-expanded={showAdminDocuments} onClick={() => setShowAdminDocuments((visible) => !visible)}>{showAdminDocuments ? "Hide documents" : "Show documents"}</Button>}
    </>} />
    <Card className="overflow-hidden"><div className="bg-gradient-to-br from-primary/15 via-primary/5 to-background p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><Avatar className="size-20 rounded-2xl"><AvatarImage src={profilePhotoUrl ?? undefined} alt={`${profile.full_name} profile`} /><AvatarFallback className="rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground">{initials}</AvatarFallback></Avatar><div><h2 className="text-2xl font-semibold">{profile.full_name}</h2><p className="mt-1 text-sm text-muted-foreground">{profile.role.name}</p><div className="mt-3 flex flex-wrap gap-2"><Badge variant={profile.is_active ? "secondary" : "destructive"}>{profile.is_active ? "Active account" : "Inactive account"}</Badge><Badge variant="outline">{profile.profile_complete ? "Profile complete" : "Profile needs attention"}</Badge></div></div></div><div className="mt-5 flex flex-wrap items-center gap-3"><Input className="max-w-sm bg-background" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && !isUploadWithinLimit(file, PROFILE_PHOTO_MAX_BYTES, "Profile photo")) { event.currentTarget.value = ""; setPhotoFile(null); return; } setPhotoFile(file); }} /><Button type="button" onClick={() => void uploadPhoto()} disabled={!photoFile || uploadingPhoto}>{uploadingPhoto ? "Uploading…" : "Upload profile photo"}</Button><span className="text-xs text-muted-foreground">JPEG, PNG, or WebP; up to 5 MB.</span></div>{photoFile && <p className="mt-2 text-xs text-muted-foreground">Selected: {photoFile.name}</p>}</div></Card>
    {error && <p className="text-sm text-destructive">{error}</p>}
    {(!isAdmin || showAdminDocuments) && <>
      <Card className="space-y-4 p-5"><div><h2 className="font-semibold">Staff documents</h2><p className="text-sm text-muted-foreground">Upload and review your reference form and contract. These files are private.</p></div><div className="grid gap-3 sm:grid-cols-2">{([ ["reference-form", "Reference form", profile.has_reference_form], ["contract", "Contract", profile.has_contract] ] as const).map(([type, title, uploaded]) => <PrivateDocumentUpload key={type} title={title} uploaded={uploaded} canUpload onUpload={async (file) => { const updated = await usersApi.uploadMyStaffDocument(type, file); setProfile(updated); await refreshAccess(); }} loadPreview={() => usersApi.getMyStaffDocumentPreview(type)} onView={() => usersApi.viewMyStaffDocument(type)} />)}</div></Card>
      <Card className="space-y-4 p-5"><div><h2 className="font-semibold">Staff KYC documents</h2><p className="text-sm text-muted-foreground">Upload your identity document, KRA document, and Certificate of Good Conduct. These files are private.</p></div><div className="grid gap-3 sm:grid-cols-2">{([ ["identity", "National ID or Birth Certificate", profile.has_identity_document], ["kra", "KRA document", profile.has_kra_document], ["good-conduct", "Certificate of Good Conduct", profile.has_good_conduct_document] ] as const).map(([type, title, uploaded]) => <PrivateDocumentUpload key={type} title={title} uploaded={uploaded} canUpload onUpload={async (file) => { const updated = await usersApi.uploadMyStaffKycDocument(type, file); setProfile(updated); await refreshAccess(); }} loadPreview={() => usersApi.getMyStaffKycDocumentPreview(type)} onView={() => usersApi.viewMyStaffKycDocument(type)} />)}</div></Card>
    </>}
    <Card className="p-5"><div className="mb-5"><h2 className="font-semibold">Personal details</h2><p className="text-sm text-muted-foreground">Empty fields have not been provided yet. Update becomes available after a change.</p></div><div className="grid gap-4 md:grid-cols-2"><Field label="Full name" value={form.full_name} onChange={(value) => setForm({ ...form, full_name: value })} /><Field label="Username" value={form.username} onChange={(value) => setForm({ ...form, username: value })} /><Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} verified={profile.email_verified} /><ReadOnlyField label="Phone" value={profile.phone ?? ""} verified={profile.phone_verified} /><GenderField value={form.gender} onChange={(gender) => setForm({ ...form, gender })} /><Field label="Nationality" value={form.nationality} placeholder="KE" onChange={(value) => setForm({ ...form, nationality: value.toUpperCase() })} /><Field label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} /><Field label="Address description" value={form.address_description} placeholder="Kilimani, near Yaya Centre" onChange={(value) => setForm({ ...form, address_description: value })} /><Field label="Date of birth" type="date" value={form.date_of_birth} max={latestAllowedDateOfBirth()} hint="You must be at least 15 years old." onChange={(value) => setForm({ ...form, date_of_birth: value })} /><Field label="Preferred language" value={form.preferred_language} placeholder="en" onChange={(value) => setForm({ ...form, preferred_language: value })} /><Field label="Residence latitude" type="number" value={form.residency_latitude} onChange={(value) => setForm({ ...form, residency_latitude: value })} /><Field label="Residence longitude" type="number" value={form.residency_longitude} onChange={(value) => setForm({ ...form, residency_longitude: value })} /><Field label="New password" type="password" value={form.password} placeholder="Leave blank to keep current password" onChange={(value) => setForm({ ...form, password: value })} /></div><div className="mt-6 flex items-center gap-3"><Button onClick={update} disabled={!dirty || saving}>{saving ? "Updating…" : "Update profile"}</Button>{dirty && <Button variant="ghost" onClick={() => setForm(toForm(profile))}>Discard changes</Button>}</div></Card>
    <Card className="p-5"><h2 className="font-semibold">Account status</h2><div className="mt-4 grid gap-3 text-sm"><ReadOnly label="Email verification" value={profile.email_verified ? "Verified" : "Not verified"} /><ReadOnly label="Phone verification" value={profile.phone_verified ? "Verified" : "Not verified"} /><ReadOnly label="Password set" value={profile.password_set ? "Yes" : "No"} /><ReadOnly label="Last sign-in" value={formatAccountDateTime(profile.last_login_at)} /><ReadOnly label="Created" value={formatAccountDateTime(profile.created_at)} /><ReadOnly label="Last updated" value={formatAccountDateTime(profile.updated_at)} /></div></Card>
  </div>;
}

function Field({ label, value, onChange, type = "text", disabled, verified, placeholder, max, hint }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean; verified?: boolean; placeholder?: string; max?: string; hint?: string }) { const id = label.toLowerCase().replaceAll(" ", "-"); return <div><div className="flex items-center justify-between"><Label htmlFor={id}>{label}</Label>{verified !== undefined && <span className={`text-xs ${verified ? "text-blue-700" : "text-muted-foreground"}`}>{verified ? "Verified" : "Not verified"}</span>}</div><Input id={id} className="mt-1" type={type} value={value} placeholder={placeholder} max={max} onChange={(event) => onChange(event.target.value)} disabled={disabled} />{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>; }
function GenderField({ value, onChange }: { value: string; onChange: (value: string) => void }) { const options = [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "non_binary", label: "Non-binary" }, { value: "other", label: "Other" }, { value: "prefer_not_to_say", label: "Prefer not to say" }]; return <div><Label>Gender</Label><Select value={value || "not_set"} onValueChange={(next) => onChange(next === "not_set" ? "" : next)}><SelectTrigger className="mt-1"><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent><SelectItem value="not_set">Not specified</SelectItem>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>; }
function ReadOnlyField({ label, value, verified }: { label: string; value: string; verified?: boolean }) { return <div><div className="flex items-center justify-between"><Label>{label}</Label>{verified !== undefined && <span className={`text-xs ${verified ? "text-blue-700" : "text-muted-foreground"}`}>{verified ? "Verified" : "Not verified"}</span>}</div><Input className="mt-1" value={value} disabled /></div>; }
function ReadOnly({ label, value }: { label: string; value: string }) { return <div className="grid grid-cols-[10rem_1fr] gap-3"><span className="text-muted-foreground">{label}</span><span className="break-words">{value || "—"}</span></div>; }
