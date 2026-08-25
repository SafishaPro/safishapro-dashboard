import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, MapPin, Plus, Power, RefreshCw, Settings2 } from "lucide-react";
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
import { cleanersApi, servicesApi, type Cleaner, type CleanerSkill, type Service } from "@/lib/api";

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
  status: "active",
  is_available: true,
  current_latitude: "",
  current_longitude: "",
  notes: "",
};
const toForm = (cleaner: Cleaner): CleanerForm => ({
  full_name: cleaner.full_name,
  phone: cleaner.phone,
  national_id: cleaner.national_id,
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

function formPayload(form: CleanerForm) {
  if (Boolean(form.current_latitude) !== Boolean(form.current_longitude))
    throw new Error("Enter both latitude and longitude, or leave both empty.");
  return {
    full_name: form.full_name,
    phone: form.phone,
    national_id: form.national_id,
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
  const [selected, setSelected] = useState<Cleaner | null>(null);
  const [form, setForm] = useState<CleanerForm>(blankForm);
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
  useEffect(() => { void Promise.all([load(), loadSkills()]); }, []);

  const view = async (cleaner: Cleaner) => {
    try {
      setError(null);
      const data = await cleanersApi.get(cleaner.id);
      setSelected(data);
      setMode("profile");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load this cleaner profile.");
    }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = formPayload(form);
      if (mode === "create") await cleanersApi.create(payload);
      else if (selected) await cleanersApi.update(selected.id, payload);
      setMode(null);
      setSelected(null);
      await load();
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
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
                <TableCell className="font-medium">{cleaner.full_name}</TableCell>
                <TableCell>{cleaner.phone}</TableCell>
                <TableCell>{cleaner.service_area || "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={cleaner.status === "active" ? "success" : "secondary"}>
                      {cleaner.status}
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
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
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
              cleaner={selected}
              can={can}
              onEdit={() => openEdit(selected)}
              onAvailability={() => openAvailability(selected)}
              onShifts={() => void loadShifts(selected)}
              onDeactivate={() => void deactivate(selected)}
              onReactivate={() => void reactivate(selected)}
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
}: {
  form: CleanerForm;
  setForm: (form: CleanerForm) => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  skills: CleanerSkill[];
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <p className="text-sm text-muted-foreground">Fields marked * are required. Add skills to make the cleaner eligible for matching.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *"><Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} placeholder="e.g. Amina Wanjiku" required /></Field>
        <Field label="Phone number *"><Input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+254 7XX XXX XXX" required /></Field>
        <Field label="National ID *"><Input value={form.national_id} onChange={(event) => setForm({ ...form, national_id: event.target.value })} placeholder="Official ID number" required /></Field>
        <Field label="Service area *"><Input value={form.service_area} onChange={(event) => setForm({ ...form, service_area: event.target.value })} placeholder="e.g. Westlands, Nairobi" required /></Field>
      </div>
      <div className="border-t pt-5"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-medium">Skills</h3><p className="text-xs text-muted-foreground">Select services this cleaner can deliver.</p></div>{form.skill_ids.length > 0 && <Badge variant="secondary">{form.skill_ids.length} selected</Badge>}</div><MultiSelect options={skills.map((skill) => ({ id: skill.id, label: skill.name, disabled: !skill.is_active }))} selected={form.skill_ids} onChange={(skill_ids) => setForm({ ...form, skill_ids })} emptyLabel="No active skills. Create one from Manage skills." /></div>
      <div className="grid gap-4 border-t pt-5 sm:grid-cols-2"><Field label="Status"><Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as Cleaner["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select></Field><label className="flex items-center gap-3 pt-6 text-sm"><Checkbox checked={form.is_available} onCheckedChange={(is_available) => setForm({ ...form, is_available: Boolean(is_available) })} /><span><span className="font-medium">Available for assignment</span><span className="block text-xs text-muted-foreground">Include in dispatch matching now</span></span></label></div>
      <div className="border-t pt-5"><div className="mb-3"><h3 className="font-medium">Location <span className="font-normal text-muted-foreground">(optional)</span></h3><p className="text-xs text-muted-foreground">Enter both coordinates for proximity matching.</p></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Latitude"><Input type="number" step="any" value={form.current_latitude} onChange={(event) => setForm({ ...form, current_latitude: event.target.value })} placeholder="-1.286389" /></Field><Field label="Longitude"><Input type="number" step="any" value={form.current_longitude} onChange={(event) => setForm({ ...form, current_longitude: event.target.value })} placeholder="36.817223" /></Field></div></div>
      <Field label="Internal notes"><Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional onboarding or operations note" /></Field>
      <div className="flex justify-end border-t pt-4"><Button>{submitLabel}</Button></div>
    </form>
  );
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
        Use this for current duty status and live location. Location coordinates must be entered
        together.
      </p>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={form.is_available}
          onChange={(event) => setForm({ ...form, is_available: event.target.checked })}
        />
        Available for assignment
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latitude">
          <Input
            type="number"
            step="any"
            value={form.current_latitude}
            onChange={(event) => setForm({ ...form, current_latitude: event.target.value })}
          />
        </Field>
        <Field label="Longitude">
          <Input
            type="number"
            step="any"
            value={form.current_longitude}
            onChange={(event) => setForm({ ...form, current_longitude: event.target.value })}
          />
        </Field>
      </div>
      <Button>Update availability</Button>
    </form>
  );
}
function CleanerProfile({
  cleaner,
  can,
  onEdit,
  onAvailability,
  onShifts,
  onDeactivate,
  onReactivate,
}: {
  cleaner: Cleaner;
  can: (...permissions: string[]) => boolean;
  onEdit: () => void;
  onAvailability: () => void;
  onShifts: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const earnings = cleaner.stats?.total_earnings_by_currency ?? {};
  const earningsLabel = Object.entries(earnings).length
    ? Object.entries(earnings).map(([currency, amount]) => `${currency} ${Number(amount).toLocaleString()}`).join(" · ")
    : "KES 0";
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Phone", cleaner.phone],
          ["National ID", cleaner.national_id],
          ["Service area", cleaner.service_area],
          ["Rating", cleaner.rating ?? "—"],
          ["Status", cleaner.status],
          ["Availability", cleaner.is_available ? "Available" : "Unavailable"],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="size-4 text-blue-900" />
          Live location
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {cleaner.current_latitude != null && cleaner.current_longitude != null
            ? `${cleaner.current_latitude}, ${cleaner.current_longitude}`
            : "Location not provided"}
        </p>
      </div>
      <div className="rounded-lg border p-3">
        <p className="text-sm font-medium">Skills & deliverable services</p>
        <div className="mt-2 space-y-2">{cleaner.skills.map((skill) => <div key={skill.id}><Badge variant="outline">{skill.name}</Badge><p className="mt-1 text-xs text-muted-foreground">{skill.services.map((service) => service.name).join(", ") || "No services mapped"}</p></div>)}{!cleaner.skills.length && <p className="text-sm text-muted-foreground">No skills selected. This cleaner cannot be matched to bookings yet.</p>}</div>
      </div>
      {cleaner.stats && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Total jobs", cleaner.stats.total_sessions], ["Completed", cleaner.stats.completed_sessions], ["Total earnings", earningsLabel], ["Rating", `${cleaner.stats.average_rating} / 5`]].map(([label, value]) => <div key={String(label)} className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}
      </div>}
      <Tabs defaultValue="jobs">
        <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="jobs">Jobs ({cleaner.job_history?.length ?? 0})</TabsTrigger><TabsTrigger value="payouts">Payouts ({cleaner.payout_history?.length ?? 0})</TabsTrigger><TabsTrigger value="audit">Audit ({cleaner.audit_history?.length ?? 0})</TabsTrigger></TabsList>
        <TabsContent value="jobs" className="mt-3 space-y-2">{cleaner.job_history?.map((job) => <div key={job.booking_id} className="rounded-lg border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{job.service_name}{job.package_name ? ` · ${job.package_name}` : ""}</p><p className="text-xs text-muted-foreground">{new Date(job.scheduled_for).toLocaleString()}</p></div><Badge variant="secondary">{job.status.replaceAll("_", " ")}</Badge></div><p className="mt-2 flex items-center gap-1 text-muted-foreground"><MapPin className="size-3" />{[job.address_line, job.city].filter(Boolean).join(", ")}</p><p className="mt-1 text-xs text-muted-foreground">Booking {job.booking_id} · {job.currency} {Number(job.quoted_price).toLocaleString()}</p></div>)}{!cleaner.job_history?.length && <EmptyHistory label="No jobs recorded for this cleaner." />}</TabsContent>
        <TabsContent value="payouts" className="mt-3 space-y-2">{cleaner.payout_history?.map((payout) => <div key={payout.payout_id} className="rounded-lg border p-3 text-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{payout.currency} {Number(payout.amount).toLocaleString()}</p><p className="text-xs text-muted-foreground">{payout.provider_reference || `Payout ${payout.payout_id}`}</p></div><Badge variant={payout.status === "paid" ? "success" : "secondary"}>{payout.status}</Badge></div><p className="mt-2 text-xs text-muted-foreground">Booking {payout.booking_id} · {new Date(payout.paid_at || payout.created_at).toLocaleString()}</p>{payout.note && <p className="mt-1 text-muted-foreground">{payout.note}</p>}</div>)}{!cleaner.payout_history?.length && <EmptyHistory label="No payouts recorded for this cleaner." />}</TabsContent>
        <TabsContent value="audit" className="mt-3 space-y-2">{cleaner.audit_history?.map((event) => <div key={event.id} className="rounded-lg border p-3 text-sm"><div className="flex items-start justify-between gap-3"><p className="font-medium">{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</p><span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span></div><p className="mt-1 text-xs text-muted-foreground">By {event.actor_email || event.actor_user_id || "System"}</p>{event.details && <p className="mt-1 break-words text-xs text-muted-foreground">{JSON.stringify(event.details)}</p>}</div>)}{!cleaner.audit_history?.length && <EmptyHistory label="No cleaner audit events recorded yet." />}</TabsContent>
      </Tabs>
      {cleaner.recent_reviews?.length ? (
        <div>
          <h3 className="mb-2 font-medium">Recent reviews</h3>
          <div className="space-y-2">
            {cleaner.recent_reviews.map((review, index) => (
              <div key={`${review.created_at}-${index}`} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{review.rating}/5</p>
                <p className="text-muted-foreground">{review.review || "No written review"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        {can("cleaners.update") && <Button onClick={onEdit}>Edit profile</Button>}
        {can("cleaner_availability.update") && (
          <Button variant="outline" onClick={onAvailability}>
            <Power className="mr-2 size-4" />
            Availability
          </Button>
        )}
        {can("schedules.read") && (
          <Button variant="outline" onClick={onShifts}>
            <CalendarDays className="mr-2 size-4" />
            Shifts
          </Button>
        )}
        {cleaner.status === "inactive"
          ? can("cleaners.update") && (
              <Button variant="outline" onClick={onReactivate}>
                Reactivate
              </Button>
            )
          : can("cleaners.delete") && (
              <Button variant="destructive" onClick={onDeactivate}>
                Deactivate
              </Button>
            )}
      </div>
    </div>
  );
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
  return <div className="rounded-md border"><div className="flex items-center justify-between border-b px-3 py-2"><span className="text-xs text-muted-foreground">{selected.length} selected</span><div className="flex gap-1"><Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={allSelected} onClick={() => onChange([...new Set([...selected, ...selectableIds])])}>Select all</Button><Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!selected.length} onClick={() => onChange([])}>Clear</Button></div></div><div className="max-h-44 space-y-2 overflow-y-auto p-3">{options.map((option) => {
    const checked = selected.includes(option.id);
    return <label key={option.id} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={checked} disabled={option.disabled && !checked} onCheckedChange={(value) => onChange(value ? [...selected, option.id] : selected.filter((id) => id !== option.id))} /><span className={option.disabled ? "text-muted-foreground" : ""}>{option.label}{option.disabled ? " (inactive)" : ""}</span></label>;
  })}</div></div>;
}
