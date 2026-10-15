import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BriefcaseBusiness, CalendarDays, FileText, MapPin, Plus, Power, RefreshCw, Settings2, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { cleanersApi, isUploadWithinLimit, PROFILE_PHOTO_MAX_BYTES, MEDIA_UPLOAD_MAX_BYTES, servicesApi, usersApi, type Cleaner, type CleanerKycDocumentType, type CleanerSkill, type Service } from "@/lib/api";
import { LocationDisplay } from "@/components/location-display";
import { LocationPicker, type LocationPickerValue } from "@/components/location-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_dash/cleaners")({ component: CleanersPage });

type Shift = {
  id: string;
  starts_at: string;
  ends_at: string;
  service_area: string | null;
  notes: string | null;
  is_active: boolean;
};
type CleanerForm = {
  full_name: string;
  phone: string;
  national_id: string;
  service_area: string;
  skill_ids: string[];
  status: Cleaner["status"];
  is_available: boolean;
  current_latitude: string;
  current_longitude: string;
  notes: string;
};
const blankForm: CleanerForm = {
  full_name: "",
  phone: "",
  national_id: "",
  service_area: "",
  skill_ids: [],
  status: "inactive",
  is_available: true,
  current_latitude: "",
  current_longitude: "",
  notes: "",
};
const toForm = (cleaner: Cleaner): CleanerForm => ({
  full_name: cleaner.full_name,
  phone: cleaner.phone,
  national_id: cleaner.national_id ?? "",
  service_area: cleaner.service_area,
  skill_ids: cleaner.skill_ids,
  status: cleaner.status,
  is_available: cleaner.is_available,
  current_latitude: cleaner.current_latitude?.toString() ?? "",
  current_longitude: cleaner.current_longitude?.toString() ?? "",
  notes: cleaner.notes ?? "",
});
const dateInput = (date: Date) => date.toISOString().slice(0, 16);
const shiftsWindow = () => ({
  starts_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  ends_at: new Date(Date.now() + 28 * 86_400_000).toISOString(),
});
const cleanerActivity = (cleaner: Cleaner) => {
  if (cleaner.status !== "active") return { label: "Inactive", className: "border-red-200 bg-red-100 text-red-800" };
  const lastJobAt = cleaner.last_completed_job_at ? new Date(cleaner.last_completed_job_at).getTime() : 0;
  const recentCutoff = Date.now() - 3 * 86_400_000;
  return lastJobAt >= recentCutoff && lastJobAt <= Date.now()
    ? { label: "Active", className: "border-emerald-200 bg-emerald-100 text-emerald-800" }
    : { label: "Active", className: "border-orange-200 bg-orange-100 text-orange-800" };
};

function formPayload(form: CleanerForm) {
  if (Boolean(form.current_latitude) !== Boolean(form.current_longitude))
    throw new Error("Enter both latitude and longitude, or leave both empty.");
  return {
    full_name: form.full_name,
    phone: form.phone,
    national_id: form.national_id.trim() || null,
    service_area: form.service_area,
    skill_ids: form.skill_ids,
    status: form.status,
    is_available: form.is_available,
    ...(form.current_latitude
      ? {
          current_latitude: Number(form.current_latitude),
          current_longitude: Number(form.current_longitude),
        }
      : {}),
    notes: form.notes || undefined,
  };
}

function CleanersPage() {
  const { can } = useAuth();
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [skills, setSkills] = useState<CleanerSkill[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [kycDocumentTypes, setKycDocumentTypes] = useState<CleanerKycDocumentType[]>([]);
  const [selected, setSelected] = useState<Cleaner | null>(null);
  const [showDocumentsFirst, setShowDocumentsFirst] = useState(false);
  const [form, setForm] = useState<CleanerForm>(blankForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [kycFiles, setKycFiles] = useState<Record<string, File | null>>({});
  const [draftCleanerId, setDraftCleanerId] = useState<string | null>(null);
  const [mode, setMode] = useState<"profile" | "create" | "edit" | "availability" | "shifts" | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [serviceArea, setServiceArea] = useState("");
  const [skillFilter, setSkillFilter] = useState("all");
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<CleanerSkill | null>(null);
  const [skillForm, setSkillForm] = useState({ name: "", description: "", service_ids: [] as string[] });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftForm, setShiftForm] = useState({
    starts_at: dateInput(new Date()),
    ends_at: dateInput(new Date(Date.now() + 8 * 3_600_000)),
    service_area: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [placeholderUrl, setPlaceholderUrl] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const data = await cleanersApi.list({
        ...(status !== "all" ? { status } : {}),
        ...(availability !== "all" ? { is_available: availability === "available" } : {}),
        ...(serviceArea ? { service_area: serviceArea } : {}),
        ...(skillFilter !== "all" ? { skill_id: skillFilter } : {}),
        ...(search.trim().length >= 2 ? { search: search.trim() } : {}),
      });
      setCleaners(data);
      setPage(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load cleaners.");
    }
  };
  const loadSkills = async () => {
    try {
      const [skillItems, serviceItems] = await Promise.all([
        cleanersApi.skills(true),
        servicesApi.list(true),
      ]);
      setSkills(skillItems);
      setServices(serviceItems);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load cleaner skills.");
    }
  };
  const loadKycDocumentTypes = async () => {
    try { setKycDocumentTypes(await cleanersApi.kycDocumentTypes()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load cleaner document requirements."); }
  };
  useEffect(() => {
    void Promise.all([load(), loadSkills(), loadKycDocumentTypes()]);
    void usersApi.cleanerPlaceholder().then(({ url }) => setPlaceholderUrl(url)).catch(() => {});
  }, []);

  const view = async (cleaner: Cleaner) => {
    try {
      setError(null);
      const data = await cleanersApi.get(cleaner.id);
      setSelected(data);
      setShowDocumentsFirst(false);
      setMode("profile");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load this cleaner profile.");
    }
  };
  const saveDocuments = async (cleanerId: string, documents: Pick<Cleaner, "national_id" | "kra_pin" | "passport_number" | "good_conduct_certificate_number" | "other_document_reference">) => {
    await cleanersApi.update(cleanerId, documents);
    setSelected(await cleanersApi.get(cleanerId));
  };
  const uploadKycFile = async (cleanerId: string, type: string, file: File) => {
    await cleanersApi.uploadKycFile(cleanerId, type, file);
    setSelected(await cleanersApi.get(cleanerId));
  };
  const viewKycFile = async (cleanerId: string, type: string) => {
    try {
      await cleanersApi.viewKycFile(cleanerId, type);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open this KYC document.");
    }
  };
  const viewLegacyKycDocument = async (cleanerId: string) => {
    try {
      await cleanersApi.viewKycDocument(cleanerId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open this KYC document.");
    }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (mode === "create") {
        if (form.full_name.trim().length < 2) throw new Error("Enter the cleaner’s full name.");
        if (form.phone.trim().length < 8) throw new Error("Enter a valid cleaner phone number.");
        if (form.service_area.trim().length < 2) throw new Error("Enter the cleaner’s service area.");
        const missingDocuments = kycDocumentTypes.filter((item) => item.is_active && item.required && !kycFiles[item.code]);
        if (!photoFile || missingDocuments.length) {
          throw new Error(`Choose a cleaner photo${missingDocuments.length ? ` and required documents: ${missingDocuments.map((item) => item.label).join(", ")}` : ""}.`);
        }
        const payload = formPayload({ ...form, full_name: form.full_name.trim(), phone: form.phone.trim(), service_area: form.service_area.trim() });
        const cleaner = draftCleanerId
          ? await cleanersApi.update(draftCleanerId, { ...payload, status: "inactive" })
          : await cleanersApi.create({ ...payload, status: "inactive" });
        if (!draftCleanerId) setDraftCleanerId(cleaner.id);
        await cleanersApi.uploadPhoto(cleaner.id, photoFile);
        for (const documentType of kycDocumentTypes.filter((item) => item.is_active)) {
          const file = kycFiles[documentType.code];
          if (file) await cleanersApi.uploadKycFile(cleaner.id, documentType.code, file);
        }
        if (can("cleaners.update")) {
          await cleanersApi.update(cleaner.id, { status: "active" });
        }
        const details = await cleanersApi.get(cleaner.id);
        setSelected(details);
        setShowDocumentsFirst(true);
        setDraftCleanerId(null);
        setPhotoFile(null);
        setKycFiles({});
        setMode("profile");
        await load();
      } else if (selected) {
        const payload = formPayload(form);
        // Preserve the cleaner's current status without revalidating activation
        // requirements during a basic profile edit.
        if (form.status === selected.status) delete payload.status;
        await cleanersApi.update(selected.id, payload);
        if (photoFile) await cleanersApi.uploadPhoto(selected.id, photoFile);
        setSelected(await cleanersApi.get(selected.id));
        setPhotoFile(null);
        setMode("profile");
        await load();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save cleaner.");
    }
  };
  const saveAvailability = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    try {
      if (Boolean(form.current_latitude) !== Boolean(form.current_longitude))
        throw new Error("Enter both latitude and longitude, or leave both empty.");
      await cleanersApi.availability(selected.id, {
        is_available: form.is_available,
        ...(form.current_latitude
          ? {
              current_latitude: Number(form.current_latitude),
              current_longitude: Number(form.current_longitude),
            }
          : {}),
      });
      await view(selected);
      await load();
      setMode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update availability.");
    }
  };
  const loadShifts = async (cleaner: Cleaner) => {
    try {
      setError(null);
      setSelected(cleaner);
      const data = await cleanersApi.shifts({ ...shiftsWindow(), cleaner_id: cleaner.id });
      setShifts(data as Shift[]);
      setShiftForm((current) => ({ ...current, service_area: cleaner.service_area }));
      setMode("shifts");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load cleaner shifts.");
    }
  };
  const createShift = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    try {
      await cleanersApi.createShift({
        cleaner_id: selected.id,
        starts_at: new Date(shiftForm.starts_at).toISOString(),
        ends_at: new Date(shiftForm.ends_at).toISOString(),
        service_area: shiftForm.service_area || undefined,
        notes: shiftForm.notes || undefined,
      });
      await loadShifts(selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create shift.");
    }
  };
  const deactivate = async (cleaner: Cleaner) => {
    if (!window.confirm(`Deactivate ${cleaner.full_name}? Their history will be kept.`)) return;
    try {
      await cleanersApi.deactivate(cleaner.id);
      setSelected(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to deactivate cleaner.");
    }
  };
  const reactivate = async (cleaner: Cleaner) => {
    try {
      await cleanersApi.update(cleaner.id, { status: "active", is_available: true });
      await view(cleaner);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reactivate cleaner.");
    }
  };

  const openCreate = () => {
    setSelected(null);
    setForm(blankForm);
    setPhotoFile(null);
    setKycFiles({});
    setDraftCleanerId(null);
    setMode("create");
  };
  const openSkillManager = () => {
    setEditingSkill(null);
    setSkillForm({ name: "", description: "", service_ids: [] });
    setSkillsOpen(true);
  };
  const editSkill = (skill: CleanerSkill) => {
    setEditingSkill(skill);
    setSkillForm({ name: skill.name, description: skill.description ?? "", service_ids: skill.service_ids });
  };
  const saveSkill = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (!skillForm.service_ids.length) throw new Error("Select at least one service for this skill.");
      const payload = { name: skillForm.name, description: skillForm.description || undefined, service_ids: skillForm.service_ids };
      if (editingSkill) await cleanersApi.updateSkill(editingSkill.id, payload);
      else await cleanersApi.createSkill(payload);
      setEditingSkill(null);
      setSkillForm({ name: "", description: "", service_ids: [] });
      await Promise.all([loadSkills(), load()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save cleaner skill.");
    }
  };
  const openEdit = (cleaner: Cleaner) => {
    setForm(toForm(cleaner));
    setPhotoFile(null);
    setKycFiles({});
    setMode("edit");
  };
  const openAvailability = (cleaner: Cleaner) => {
    setForm(toForm(cleaner));
    setMode("availability");
  };
  const totalPages = Math.max(1, Math.ceil(cleaners.length / pageSize));
  const visibleCleaners = cleaners.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cleaner profiles"
        description="Create, manage, and dispatch cleaner availability and schedules."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
            {can("cleaners.read") && <Button variant="outline" onClick={openSkillManager}><Settings2 className="mr-2 size-4" />Manage skills</Button>}
            {can("cleaners.create") && (
              <Button onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                Add cleaner
              </Button>
            )}
          </div>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            className="max-w-sm"
            placeholder="Search name, phone, or national ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Input
            className="w-44"
            placeholder="Service area"
            value={serviceArea}
            onChange={(event) => setServiceArea(event.target.value)}
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={availability} onValueChange={setAvailability}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All availability</SelectItem>
              <SelectItem value="available">Available now</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
            </SelectContent>
          </Select>
          <Select value={skillFilter} onValueChange={setSkillFilter}>
            <SelectTrigger className="w-52"><SelectValue placeholder="All skills" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All skills</SelectItem>{skills.filter((skill) => skill.is_active).map((skill) => <SelectItem key={skill.id} value={skill.id}>{skill.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => void load()}>Apply filters</Button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-label="Cleaner activity legend">
          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">Active</Badge>
          <Badge className="border-orange-200 bg-orange-100 text-orange-800">Active</Badge>
          <Badge className="border-red-200 bg-red-100 text-red-800">Inactive</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead className="w-16">Photo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCleaners.map((cleaner, index) => (
              <TableRow key={cleaner.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{String((page - 1) * pageSize + index + 1).padStart(2, "0")}</TableCell>
                <TableCell><CleanerAvatar cleaner={cleaner} placeholderUrl={placeholderUrl} /></TableCell>
                <TableCell className="font-medium">{cleaner.full_name}</TableCell>
                <TableCell>{cleaner.phone}</TableCell>
                <TableCell className="max-w-[200px]">
                  <LocationDisplay
                    lat={cleaner.current_latitude}
                    lng={cleaner.current_longitude}
                    city={cleaner.service_area}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge className={cleanerActivity(cleaner).className}>
                      {cleanerActivity(cleaner).label}
                    </Badge>
                    <Badge variant={cleaner.is_available ? "outline" : "secondary"}>
                      {cleaner.is_available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    className="bg-blue-950 text-white hover:bg-blue-900"
                    onClick={() => void view(cleaner)}
                  >
                    View profile
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!cleaners.length && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                  No cleaner profiles found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {cleaners.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm"><p className="text-muted-foreground">Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, cleaners.length)} of {cleaners.length} cleaners</p><div className="flex items-center gap-2"><Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10 per page</SelectItem><SelectItem value="20">20 per page</SelectItem><SelectItem value="50">50 per page</SelectItem></SelectContent></Select><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-muted-foreground">Page {page} of {totalPages}</span><Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
      </Card>
      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open) setMode(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "create"
                ? "Add cleaner"
                : mode === "edit"
                  ? "Edit cleaner"
                  : mode === "availability"
                    ? "Live availability"
                    : mode === "shifts"
                      ? "Cleaner shifts"
                      : selected?.full_name || "Cleaner profile"}
            </DialogTitle>
          </DialogHeader>
          {mode === "create" || mode === "edit" ? (
            <CleanerForm
              form={form}
              setForm={setForm}
              onSubmit={save}
              submitLabel={mode === "create" ? "Create cleaner" : "Save changes"}
              skills={skills.filter((skill) => skill.is_active || form.skill_ids.includes(skill.id))}
              kycDocumentTypes={kycDocumentTypes.filter((item) => item.is_active)}
              isCreating={mode === "create"}
              currentPhotoCleanerId={selected?.id ?? null}
              currentPhotoUrl={selected?.profile_photo_url ?? placeholderUrl}
              photoFile={photoFile}
              setPhotoFile={setPhotoFile}
              kycFiles={kycFiles}
              setKycFiles={setKycFiles}
            />
          ) : mode === "availability" ? (
            <AvailabilityForm form={form} setForm={setForm} onSubmit={saveAvailability} />
          ) : mode === "shifts" && selected ? (
            <ShiftManager
              shifts={shifts}
              form={shiftForm}
              setForm={setShiftForm}
              canCreate={can("schedules.create")}
              canDelete={can("schedules.delete")}
              onSubmit={createShift}
              onDeactivate={async (shift) => {
                try {
                  await cleanersApi.deactivateShift(shift.id);
                  await loadShifts(selected);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Unable to deactivate shift.");
                }
              }}
            />
          ) : selected ? (
            <CleanerProfile
              key={selected.id}
              cleaner={selected}
              kycDocumentTypes={kycDocumentTypes.filter((item) => item.is_active)}
              placeholderUrl={placeholderUrl}
              initialTab={showDocumentsFirst ? "documents" : "profile"}
              can={can}
              onEdit={() => openEdit(selected)}
              onAvailability={() => openAvailability(selected)}
              onShifts={() => void loadShifts(selected)}
              onDeactivate={() => void deactivate(selected)}
              onReactivate={() => void reactivate(selected)}
              onSaveDocuments={saveDocuments}
              onViewKycFile={(type) => void viewKycFile(selected.id, type)}
              onViewLegacyKycDocument={() => void viewLegacyKycDocument(selected.id)}
              onUploadKycFile={(type, file) => uploadKycFile(selected.id, type, file)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={skillsOpen} onOpenChange={setSkillsOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Cleaner skills & service mapping</DialogTitle></DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            {(can("cleaners.create") || can("cleaners.update")) && <form className="space-y-4 rounded-lg border p-4" onSubmit={saveSkill}>
              <h3 className="font-medium">{editingSkill ? "Edit skill" : "Create skill"}</h3>
              <Field label="Skill name"><Input value={skillForm.name} onChange={(event) => setSkillForm({ ...skillForm, name: event.target.value })} required /></Field>
              <Field label="Description"><Input value={skillForm.description} onChange={(event) => setSkillForm({ ...skillForm, description: event.target.value })} /></Field>
              <Field label="Services this skill can deliver"><MultiSelect options={services.map((service) => ({ id: service.id, label: service.name, disabled: !service.is_active }))} selected={skillForm.service_ids} onChange={(service_ids) => setSkillForm({ ...skillForm, service_ids })} /></Field>
              <div className="flex gap-2"><Button>{editingSkill ? "Save skill" : "Create skill"}</Button>{editingSkill && <Button type="button" variant="outline" onClick={() => { setEditingSkill(null); setSkillForm({ name: "", description: "", service_ids: [] }); }}>Cancel</Button>}</div>
            </form>}
            <div className="space-y-2">{skills.map((skill) => <div key={skill.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{skill.name}</p><p className="text-sm text-muted-foreground">{skill.description || "No description"}</p><div className="mt-2 flex flex-wrap gap-1">{skill.services.map((service) => <Badge key={service.id} variant="outline">{service.name}</Badge>)}</div></div><Badge variant={skill.is_active ? "success" : "secondary"}>{skill.is_active ? "Active" : "Inactive"}</Badge></div><div className="mt-3 flex gap-2">{can("cleaners.update") && <Button size="sm" variant="outline" onClick={() => editSkill(skill)}>Edit</Button>}{can("cleaners.delete") && skill.is_active && <Button size="sm" variant="destructive" onClick={async () => { if (!window.confirm(`Deactivate ${skill.name}?`)) return; await cleanersApi.deactivateSkill(skill.id); await Promise.all([loadSkills(), load()]); }}>Deactivate</Button>}</div></div>)}</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CleanerForm({
  form,
  setForm,
  onSubmit,
  submitLabel,
  skills,
  kycDocumentTypes,
  isCreating,
  currentPhotoCleanerId,
  currentPhotoUrl,
  photoFile,
  setPhotoFile,
  kycFiles,
  setKycFiles,
}: {
  form: CleanerForm;
  setForm: (form: CleanerForm) => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  skills: CleanerSkill[];
  kycDocumentTypes: CleanerKycDocumentType[];
  isCreating: boolean;
  currentPhotoCleanerId: string | null;
  currentPhotoUrl: string | null;
  photoFile: File | null;
  setPhotoFile: (file: File | null) => void;
  kycFiles: Record<string, File | null>;
  setKycFiles: (files: Record<string, File | null>) => void;
}) {
  const resolvedPhotoUrl = useCleanerPhotoUrl(currentPhotoCleanerId, currentPhotoUrl);
  const readyToCreate = !isCreating || (
    form.full_name.trim().length >= 2 &&
    form.phone.trim().length >= 8 &&
    form.service_area.trim().length >= 2 &&
    Boolean(photoFile && kycDocumentTypes.filter((item) => item.required).every((item) => kycFiles[item.code]))
  );
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <p className="text-sm text-muted-foreground">Fields marked * are required. Add the cleaner photo and each required document before creating the record. Optional documents can be added now or later. Add skills to make the cleaner eligible for matching.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *"><Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} placeholder="e.g. Amina Wanjiku" required /></Field>
        <Field label="Phone number *"><Input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+254 7XX XXX XXX" required /></Field>
        <Field label="National ID number (optional with birth certificate)"><Input value={form.national_id} onChange={(event) => setForm({ ...form, national_id: event.target.value })} placeholder="Official ID number, if available" /></Field>
        <Field label="Service area *"><Input value={form.service_area} onChange={(event) => setForm({ ...form, service_area: event.target.value })} placeholder="e.g. Westlands, Nairobi" required /></Field>
      </div>
      <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="cleaner-photo">{isCreating ? "Cleaner photo *" : "Replace cleaner photo (optional)"}</Label>{resolvedPhotoUrl && !photoFile && <img src={resolvedPhotoUrl} alt="Current cleaner profile" className="size-20 rounded-lg object-cover" />}<Input id="cleaner-photo" type="file" accept="image/jpeg,image/png,image/webp" required={isCreating && !photoFile} onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && !isUploadWithinLimit(file, PROFILE_PHOTO_MAX_BYTES, "Cleaner photo")) { event.currentTarget.value = ""; setPhotoFile(null); return; } setPhotoFile(file); }} /><p className="text-xs text-muted-foreground">JPEG, PNG, or WebP; up to 5 MB.</p>{photoFile && <p className="text-xs font-medium">Selected: {photoFile.name}</p>}</div>
        {isCreating && kycDocumentTypes.map((document) => <DocumentFileInput key={document.code} id={`cleaner-${document.code}`} label={`${document.label}${document.required ? " *" : " (optional)"}`} file={kycFiles[document.code] ?? null} required={document.required} onChange={(file) => setKycFiles({ ...kycFiles, [document.code]: file })} />)}
      </div>
      <div className="border-t pt-5"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-medium">Skills</h3><p className="text-xs text-muted-foreground">Select services this cleaner can deliver.</p></div>{form.skill_ids.length > 0 && <Badge variant="secondary">{form.skill_ids.length} selected</Badge>}</div><MultiSelect options={skills.map((skill) => ({ id: skill.id, label: skill.name, disabled: !skill.is_active }))} selected={form.skill_ids} onChange={(skill_ids) => setForm({ ...form, skill_ids })} emptyLabel="No active skills. Create one from Manage skills." /></div>
      <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">{isCreating ? <p className="self-center text-sm text-muted-foreground">The cleaner is activated after the photo and all required documents upload successfully.</p> : <Field label="Status"><Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as Cleaner["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select></Field>}<label className="flex items-center gap-3 pt-2 text-sm"><Checkbox checked={form.is_available} onCheckedChange={(is_available) => setForm({ ...form, is_available: Boolean(is_available) })} /><span><span className="font-medium">Available for assignment</span><span className="block text-xs text-muted-foreground">Include in dispatch matching now</span></span></label></div>
      <div className="border-t pt-5">
        <LocationPicker
          latitude={form.current_latitude}
          longitude={form.current_longitude}
          city={form.service_area}
          onChange={(val: LocationPickerValue) =>
            setForm({
              ...form,
              current_latitude: val.latitude != null ? String(val.latitude) : "",
              current_longitude: val.longitude != null ? String(val.longitude) : "",
              service_area: form.service_area || val.city,
            })
          }
          label="Cleaner Duty Location & Base Map"
          placeholder="Search cleaner base area, zone, or landmark…"
          showCoordinates={false}
        />
      </div>
      <Field label="Internal notes"><Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional onboarding or operations note" /></Field>
      <div className="flex justify-end border-t pt-4"><Button disabled={!readyToCreate}>{submitLabel}</Button></div>
    </form>
  );
}

function DocumentFileInput({
  id,
  label,
  file,
  required = false,
  onChange,
}: {
  id: string;
  label: string;
  file: File | null;
  required?: boolean;
  onChange: (file: File | null) => void;
}) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required={required && !file} onChange={(event) => { const selected = event.target.files?.[0] ?? null; if (selected && !isUploadWithinLimit(selected, MEDIA_UPLOAD_MAX_BYTES, "KYC document")) { event.currentTarget.value = ""; onChange(null); return; } onChange(selected); }} /><p className="text-xs text-muted-foreground">PDF or image; up to 10 MB. Stored privately.</p>{file && <p className="text-xs font-medium">Selected: {file.name}</p>}</div>;
}
function AvailabilityForm({
  form,
  setForm,
  onSubmit,
}: {
  form: CleanerForm;
  setForm: (form: CleanerForm) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <p className="text-sm text-muted-foreground">
        Update availability and choose the cleaner’s current duty location.
      </p>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={form.is_available}
          onChange={(event) => setForm({ ...form, is_available: event.target.checked })}
        />
        Available for assignment
      </label>
      <div>
        <LocationPicker
          latitude={form.current_latitude}
          longitude={form.current_longitude}
          city={form.service_area}
          onChange={(val: LocationPickerValue) =>
            setForm({
              ...form,
              current_latitude: val.latitude != null ? String(val.latitude) : "",
              current_longitude: val.longitude != null ? String(val.longitude) : "",
            })
          }
          label="Current Live Location"
          placeholder="Search live cleaner location…"
          showCoordinates={false}
        />
      </div>
      <Button>Update availability</Button>
    </form>
  );
}
function CleanerProfile({
  cleaner, kycDocumentTypes, placeholderUrl, initialTab, can, onEdit, onAvailability, onShifts, onDeactivate, onReactivate, onSaveDocuments, onViewKycFile, onViewLegacyKycDocument, onUploadKycFile,
}: {
  cleaner: Cleaner;
  kycDocumentTypes: CleanerKycDocumentType[];
  placeholderUrl: string | null;
  initialTab: "profile" | "documents";
  can: (...permissions: string[]) => boolean;
  onEdit: () => void;
  onAvailability: () => void;
  onShifts: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onSaveDocuments: (cleanerId: string, documents: Pick<Cleaner, "national_id" | "kra_pin" | "passport_number" | "good_conduct_certificate_number" | "other_document_reference">) => Promise<void>;
  onViewKycFile: (type: string) => void;
  onViewLegacyKycDocument: () => void;
  onUploadKycFile: (type: string, file: File) => Promise<void>;
}) {
  const earnings = cleaner.stats?.total_earnings_by_currency ?? {};
  const earningsLabel = Object.entries(earnings).length
    ? Object.entries(earnings).map(([currency, amount]) => `${currency} ${Number(amount).toLocaleString()}`).join(" · ")
    : "KES 0";
  const [documents, setDocuments] = useState({
    national_id: cleaner.national_id ?? "",
    kra_pin: cleaner.kra_pin ?? "",
    passport_number: cleaner.passport_number ?? "",
    good_conduct_certificate_number: cleaner.good_conduct_certificate_number ?? "",
    other_document_reference: cleaner.other_document_reference ?? "",
  });
  const [savingDocuments, setSavingDocuments] = useState(false);
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const [kycFiles, setKycFiles] = useState<Record<string, File | null>>({});
  const [uploadingKyc, setUploadingKyc] = useState<string | null>(null);
  const [kycUploadMessage, setKycUploadMessage] = useState<string | null>(null);
  const legacyUploaded: Record<string, boolean> = {
    identity: cleaner.has_identity_document,
    kra: cleaner.has_kra_document,
    "good-conduct": cleaner.has_good_conduct_document,
    "reference-form": cleaner.has_reference_form,
    contract: cleaner.has_contract,
  };
  const kycDocuments = kycDocumentTypes.map((document) => ({
    ...document,
    uploaded: legacyUploaded[document.code] ?? (cleaner.custom_kyc_document_types ?? []).includes(document.code),
  }));
  const uploadSelectedKyc = async (type: string) => {
    const file = kycFiles[type];
    if (!file) return;
    setUploadingKyc(type);
    setKycUploadMessage(null);
    try {
      await onUploadKycFile(type, file);
      setKycFiles((current) => ({ ...current, [type]: null }));
      setKycUploadMessage("KYC document uploaded.");
    } catch (cause) {
      setKycUploadMessage(cause instanceof Error ? cause.message : "Unable to upload KYC document.");
    } finally {
      setUploadingKyc(null);
    }
  };
  const saveDocumentDetails = async (event: FormEvent) => {
    event.preventDefault();
    setSavingDocuments(true);
    setDocumentMessage(null);
    try {
      await onSaveDocuments(cleaner.id, {
        national_id: documents.national_id.trim() || null,
        kra_pin: documents.kra_pin.trim() || null,
        passport_number: documents.passport_number.trim() || null,
        good_conduct_certificate_number: documents.good_conduct_certificate_number.trim() || null,
        other_document_reference: documents.other_document_reference.trim() || null,
      });
      setDocumentMessage("Document details saved.");
    } catch (cause) {
      setDocumentMessage(cause instanceof Error ? cause.message : "Unable to save document details.");
    } finally {
      setSavingDocuments(false);
    }
  };
  return <div className="space-y-5">
    <Tabs defaultValue={initialTab} className="space-y-4">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
        <TabsTrigger value="profile" className="gap-2 py-2.5"><ShieldCheck className="size-4" />Profile</TabsTrigger>
        <TabsTrigger value="skills" className="gap-2 py-2.5"><Sparkles className="size-4" />Skills</TabsTrigger>
        <TabsTrigger value="documents" className="gap-2 py-2.5"><FileText className="size-4" />Documents</TabsTrigger>
        <TabsTrigger value="history" className="gap-2 py-2.5"><BriefcaseBusiness className="size-4" />Jobs &amp; Payouts</TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="mt-0 space-y-4">
        <Card className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Cleaner details</h3><p className="mt-1 text-sm text-muted-foreground">Contact, service area, and current work status.</p></div><Badge className={cleanerActivity(cleaner).className}>{cleanerActivity(cleaner).label}</Badge></div>
          <CleanerAvatar cleaner={cleaner} placeholderUrl={placeholderUrl} large />
          <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{[["Phone", cleaner.phone], ["Service area", cleaner.service_area], ["Rating", cleaner.rating ?? "—"], ["Availability", cleaner.is_available ? "Available" : "Unavailable"], ["Joined", new Date(cleaner.created_at).toLocaleDateString()]].map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>)}<div><p className="text-xs text-muted-foreground">Last completed job</p><p className="mt-1 font-medium">{cleaner.last_completed_job_at ? new Date(cleaner.last_completed_job_at).toLocaleString() : "No completed jobs yet"}</p></div></div>
        </Card>
        <Card className="p-4 sm:p-5"><h3 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-blue-700" />Live location</h3><p className="mt-2 text-sm font-medium"><LocationDisplay lat={cleaner.current_latitude} lng={cleaner.current_longitude} city={cleaner.service_area} fallback="Location not provided" /></p></Card>
        {cleaner.stats && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Total jobs", cleaner.stats.total_sessions], ["Completed", cleaner.stats.completed_sessions], ["Total earnings", earningsLabel], ["Rating", `${cleaner.stats.average_rating} / 5`]].map(([label, value]) => <Card key={String(label)} className="p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></Card>)}</div>}
        {cleaner.recent_reviews?.length ? <Card className="p-4"><h3 className="font-semibold">Recent reviews</h3><div className="mt-3 space-y-2">{cleaner.recent_reviews.map((review, index) => <div key={`${review.created_at}-${index}`} className="rounded-md border p-3 text-sm"><div className="flex justify-between gap-2"><p className="font-medium">{review.rating}/5</p><span className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</span></div><p className="mt-1 text-muted-foreground">{review.review || "No written review"}</p></div>)}</div></Card> : null}
      </TabsContent>
      <TabsContent value="skills" className="mt-0 space-y-3"><div><h3 className="font-semibold">Skills &amp; services</h3><p className="mt-1 text-sm text-muted-foreground">Service types this cleaner can be matched to.</p></div>
        {cleaner.skills.length ? cleaner.skills.map((skill) => <Card key={skill.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-medium">{skill.name}</h4><p className="mt-1 text-sm text-muted-foreground">{skill.description || "No skill description"}</p></div><Badge variant={skill.is_active ? "success" : "secondary"}>{skill.is_active ? "Active" : "Inactive"}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{skill.services.map((service) => <Badge key={service.id} variant="outline">{service.name}</Badge>)}{!skill.services.length && <span className="text-sm text-muted-foreground">No services mapped</span>}</div></Card>) : <EmptyHistory label="No skills have been assigned to this cleaner yet." />}
      </TabsContent>
      <TabsContent value="documents" className="mt-0 space-y-4"><Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><FileText className="size-5" /></span><div><h3 className="font-semibold">Configured documents</h3><p className="mt-1 text-sm text-muted-foreground">Required and optional documents set by your administrator. Files are stored privately.</p></div></div>
        {cleaner.has_kyc_document && !cleaner.has_identity_document && !cleaner.has_kra_document && !cleaner.has_good_conduct_document && !cleaner.has_reference_form && !cleaner.has_contract && !(cleaner.custom_kyc_document_types?.length) && <div className="mt-4 flex items-center justify-between rounded-lg border p-3"><p className="text-sm">Existing KYC file</p>{can("cleaners.read") && <Button type="button" size="sm" variant="outline" onClick={onViewLegacyKycDocument}>View existing file</Button>}</div>}
        <div className="mt-4 grid gap-3">{kycDocuments.map((document) => <div key={document.code} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{document.label} <span className="text-xs font-normal text-muted-foreground">{document.required ? "Required" : "Optional"}</span></p><p className="text-xs text-muted-foreground">{document.uploaded ? "Submitted" : "Not submitted"}</p></div>{document.uploaded && can("cleaners.read") && <Button type="button" size="sm" variant="outline" onClick={() => onViewKycFile(document.code)}><FileText className="mr-2 size-4" />View</Button>}</div>
          {(document.uploaded || kycFiles[document.code]) && <KycDocumentPreview cleanerId={cleaner.id} type={document.code} uploaded={document.uploaded} file={kycFiles[document.code] ?? null} />}
          {can("cleaners.update") && <div className="mt-3 flex flex-wrap items-center gap-2"><Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && !isUploadWithinLimit(file, MEDIA_UPLOAD_MAX_BYTES, "KYC document")) { event.currentTarget.value = ""; setKycFiles((current) => ({ ...current, [document.code]: null })); return; } setKycFiles((current) => ({ ...current, [document.code]: file })); }} /><Button type="button" size="sm" disabled={!kycFiles[document.code] || uploadingKyc !== null} onClick={() => void uploadSelectedKyc(document.code)}>{uploadingKyc === document.code ? "Uploading…" : document.uploaded ? "Replace file" : "Upload file"}</Button><span className="text-xs text-muted-foreground">PDF or image; up to 10 MB.</span></div>}
        </div>)}</div>{kycUploadMessage && <p role="status" className="mt-3 text-sm">{kycUploadMessage}</p>}
        <div className="mt-4">{cleaner.profile_photo_url && <a href={cleaner.profile_photo_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline underline-offset-4">View cleaner photo</a>}</div>
      </Card><Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><FileText className="size-5" /></span><div><h3 className="font-semibold">KYC document details</h3><p className="mt-1 text-sm text-muted-foreground">Document numbers and references.</p></div></div>
        <form className="mt-5 space-y-4" onSubmit={saveDocumentDetails}><div className="grid gap-4 sm:grid-cols-2">{([["National ID number", "national_id", "Enter national ID number"], ["KRA PIN", "kra_pin", "Enter KRA PIN"], ["Passport number", "passport_number", "Optional"], ["Certificate of Good Conduct reference", "good_conduct_certificate_number", "Certificate or application reference"], ["Other document reference", "other_document_reference", "Optional reference"]] as const).map(([label, key, placeholder]) => <div key={key} className="space-y-2"><Label htmlFor={`cleaner-${key}`}>{label}</Label><Input id={`cleaner-${key}`} value={documents[key] ?? ""} placeholder={placeholder} disabled={!can("cleaners.update")} onChange={(event) => setDocuments((current) => ({ ...current, [key]: event.target.value }))} /></div>)}</div>
          {documentMessage && <p role="status" className={`text-sm ${documentMessage.includes("saved") ? "text-emerald-700" : "text-destructive"}`}>{documentMessage}</p>}{can("cleaners.update") && <div className="flex justify-end"><Button type="submit" disabled={savingDocuments}>{savingDocuments ? <RefreshCw className="mr-2 size-4 animate-spin" /> : <FileText className="mr-2 size-4" />}{savingDocuments ? "Saving…" : "Save document details"}</Button></div>}
        </form></Card>
      </TabsContent>
      <TabsContent value="history" className="mt-0 space-y-4"><div><h3 className="font-semibold">Jobs &amp; payouts</h3><p className="mt-1 text-sm text-muted-foreground">Review completed work, payout progress, and change history.</p></div>
        <div className="grid gap-2 sm:grid-cols-3"><Card className="p-3"><p className="text-xs text-muted-foreground">Jobs</p><p className="mt-1 text-xl font-semibold">{cleaner.job_history?.length ?? 0}</p></Card><Card className="p-3"><p className="text-xs text-muted-foreground">Paid payouts</p><p className="mt-1 text-xl font-semibold">{cleaner.stats?.paid_payouts ?? 0}</p></Card><Card className="p-3"><p className="text-xs text-muted-foreground">Pending payouts</p><p className="mt-1 text-xl font-semibold">{cleaner.stats?.pending_payouts ?? 0}</p></Card></div>
        <Tabs defaultValue="jobs"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="jobs">Jobs ({cleaner.job_history?.length ?? 0})</TabsTrigger><TabsTrigger value="payouts">Payouts ({cleaner.payout_history?.length ?? 0})</TabsTrigger><TabsTrigger value="audit">Audit ({cleaner.audit_history?.length ?? 0})</TabsTrigger></TabsList>
          <TabsContent value="jobs" className="mt-3 space-y-2">{cleaner.job_history?.map((job) => <Card key={job.booking_id} className="p-4 text-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{job.service_name}{job.package_name ? ` · ${job.package_name}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(job.scheduled_for).toLocaleString()}</p></div><Badge variant="secondary">{job.status.replaceAll("_", " ")}</Badge></div><p className="mt-2 flex items-center gap-1 text-muted-foreground"><MapPin className="size-3" />{[job.address_line, job.city].filter(Boolean).join(", ")}</p><p className="mt-1 text-xs text-muted-foreground">Booking {job.booking_id} · {job.currency} {Number(job.quoted_price).toLocaleString()}</p></Card>)}{!cleaner.job_history?.length && <EmptyHistory label="No jobs recorded for this cleaner." />}</TabsContent>
          <TabsContent value="payouts" className="mt-3 space-y-2">{cleaner.payout_history?.map((payout) => <Card key={payout.payout_id} className="p-4 text-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{payout.currency} {Number(payout.amount).toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">{payout.provider_reference || `Payout ${payout.payout_id}`}</p></div><Badge variant={payout.status === "paid" ? "success" : "secondary"}>{payout.status}</Badge></div><p className="mt-2 text-xs text-muted-foreground">Booking {payout.booking_id} · {new Date(payout.paid_at || payout.created_at).toLocaleString()}</p>{payout.note && <p className="mt-1 text-muted-foreground">{payout.note}</p>}</Card>)}{!cleaner.payout_history?.length && <EmptyHistory label="No payouts recorded for this cleaner." />}</TabsContent>
          <TabsContent value="audit" className="mt-3 space-y-2">{cleaner.audit_history?.map((event) => <Card key={event.id} className="p-4 text-sm"><div className="flex items-start justify-between gap-3"><p className="font-medium">{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</p><span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span></div><p className="mt-1 text-xs text-muted-foreground">By {event.actor_email || event.actor_user_id || "System"}</p>{event.details && <p className="mt-1 break-words text-xs text-muted-foreground">{JSON.stringify(event.details)}</p>}</Card>)}{!cleaner.audit_history?.length && <EmptyHistory label="No cleaner audit events recorded yet." />}</TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
    <div className="flex flex-wrap gap-2 border-t pt-4">{can("cleaners.update") && <Button onClick={onEdit}>Edit profile</Button>}{can("cleaner_availability.update") && <Button variant="outline" onClick={onAvailability}><Power className="mr-2 size-4" />Availability</Button>}{can("schedules.read") && <Button variant="outline" onClick={onShifts}><CalendarDays className="mr-2 size-4" />Shifts</Button>}{cleaner.status === "inactive" ? can("cleaners.update") && <Button variant="outline" onClick={onReactivate}>Reactivate</Button> : can("cleaners.delete") && <Button variant="destructive" onClick={onDeactivate}>Deactivate</Button>}</div>
  </div>;
}

function KycDocumentPreview({ cleanerId, type, uploaded, file }: {
  cleanerId: string;
  type: string;
  uploaded: boolean;
  file: File | null;
}) {
  const [preview, setPreview] = useState<{ url: string; contentType: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setPreview(null);
    setFailed(false);
    const load = file
      ? Promise.resolve(file)
      : uploaded
        ? cleanersApi.getKycFilePreview(cleanerId, type)
        : Promise.resolve(null);
    void load.then((blob) => {
      if (!blob || !active) return;
      objectUrl = URL.createObjectURL(blob);
      setPreview({ url: objectUrl, contentType: blob.type || file?.type || "" });
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cleanerId, file, type, uploaded]);

  return <div className="mt-3 flex min-h-16 items-center gap-3 rounded-md bg-muted/40 p-2">
    {preview?.contentType.startsWith("image/") ? <img src={preview.url} alt={`${type} document preview`} className="h-16 w-14 rounded border bg-background object-cover" />
      : preview?.contentType === "application/pdf" ? <iframe title={`${type} PDF preview`} src={preview.url} className="h-24 w-20 overflow-hidden rounded border bg-background" />
        : <div className="flex h-16 w-14 items-center justify-center rounded border bg-background text-muted-foreground"><FileText className="size-6" /></div>}
    <p className="text-xs text-muted-foreground">{preview ? (file ? file.name : "Uploaded document preview") : failed ? "Preview unavailable" : "Loading preview…"}</p>
  </div>;
}

function ShiftManager({
  shifts,
  form,
  setForm,
  canCreate,
  canDelete,
  onSubmit,
  onDeactivate,
}: {
  shifts: Shift[];
  form: { starts_at: string; ends_at: string; service_area: string; notes: string };
  setForm: (form: {
    starts_at: string;
    ends_at: string;
    service_area: string;
    notes: string;
  }) => void;
  canCreate: boolean;
  canDelete: boolean;
  onSubmit: (event: FormEvent) => void;
  onDeactivate: (shift: Shift) => void;
}) {
  return (
    <div className="space-y-5">
      {canCreate && (
        <form className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <Field label="Starts">
            <Input
              type="datetime-local"
              value={form.starts_at}
              onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
              required
            />
          </Field>
          <Field label="Ends">
            <Input
              type="datetime-local"
              value={form.ends_at}
              onChange={(event) => setForm({ ...form, ends_at: event.target.value })}
              required
            />
          </Field>
          <Field label="Service area">
            <Input
              value={form.service_area}
              onChange={(event) => setForm({ ...form, service_area: event.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Input
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button>Add shift</Button>
          </div>
        </form>
      )}
      <div className="space-y-2">
        {shifts.length ? (
          shifts.map((shift) => (
            <div
              key={shift.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {new Date(shift.starts_at).toLocaleString()} -{" "}
                  {new Date(shift.ends_at).toLocaleString()}
                </p>
                <p className="text-muted-foreground">
                  {[shift.service_area, shift.notes].filter(Boolean).join(" · ") || "No notes"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={shift.is_active ? "success" : "secondary"}>
                  {shift.is_active ? "Active" : "Inactive"}
                </Badge>
                {canDelete && shift.is_active && (
                  <Button size="sm" variant="destructive" onClick={() => onDeactivate(shift)}>
                    Deactivate
                  </Button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No shifts in the current five-week window.
          </p>
        )}
      </div>
    </div>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function EmptyHistory({ label }: { label: string }) {
  return <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">{label}</p>;
}

function MultiSelect({
  options,
  selected,
  onChange,
  emptyLabel = "No options available.",
}: {
  options: Array<{ id: string; label: string; disabled?: boolean }>;
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyLabel?: string;
}) {
  if (!options.length) return <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{emptyLabel}</p>;
  const selectableIds = options.filter((option) => !option.disabled || selected.includes(option.id)).map((option) => option.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));
  return <div className="rounded-md border"><div className="flex items-center justify-between border-b px-3 py-2"><span className="text-xs text-muted-foreground">{selected.length} selected</span><div className="flex gap-1"><Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={allSelected} onClick={() => onChange([...new Set([...selected, ...selectableIds])])}>Select all</Button><Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!selected.length} onClick={() => onChange([])}>Clear</Button></div></div><div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto p-2 sm:grid-cols-2">{options.map((option) => {
    const checked = selected.includes(option.id);
    return <label key={option.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs"><Checkbox checked={checked} disabled={option.disabled && !checked} onCheckedChange={(value) => onChange(value ? [...selected, option.id] : selected.filter((id) => id !== option.id))} /><span className={`truncate ${option.disabled ? "text-muted-foreground" : ""}`}>{option.label}{option.disabled ? " (inactive)" : ""}</span></label>;
  })}</div></div>;
}

function CleanerAvatar({ cleaner, placeholderUrl, large = false }: { cleaner: Cleaner; placeholderUrl: string | null; large?: boolean }) {
  const initials = cleaner.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";
  const photoUrl = useCleanerPhotoUrl(cleaner.id, cleaner.profile_photo_url);
  return <Avatar className={large ? "mt-4 size-24 rounded-xl" : "size-10"}>
    <AvatarImage src={(cleaner.profile_photo_url ? photoUrl : placeholderUrl) ?? undefined} alt={`${cleaner.full_name} profile`} />
    <AvatarFallback>{initials}</AvatarFallback>
  </Avatar>;
}

function useCleanerPhotoUrl(cleanerId: string | null, storedPhotoUrl: string | null) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setSignedUrl(null);
    if (!cleanerId || !storedPhotoUrl) return () => { active = false; };
    void cleanersApi.photoUrl(cleanerId)
      .then(({ url }) => { if (active) setSignedUrl(url); })
      .catch(() => { if (active) setSignedUrl(null); });
    return () => { active = false; };
  }, [cleanerId, storedPhotoUrl]);
  return signedUrl ?? storedPhotoUrl;
}
