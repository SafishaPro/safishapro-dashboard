import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Pencil, Plus, Power, Save, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { registrationFieldsApi, type RegistrationField } from "@/lib/api";

export const Route = createFileRoute("/_dash/registration-fields")({ component: RegistrationFieldsPage });

type FieldDraft = Omit<RegistrationField, "id">;
const kinds: RegistrationField["input_type"][] = ["text", "email", "number", "date", "boolean", "single_choice", "multiple_choice", "password"];
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const typeName = (value: RegistrationField["input_type"]) => value === "single_choice" ? "Dropdown" : value === "multiple_choice" ? "Multiple choice" : pretty(value);
const emptyField = (): FieldDraft => ({ key: "", label: "", input_type: "text", required: false, options: [], help_text: null, position: 0, is_active: true });
const choiceKinds: RegistrationField["input_type"][] = ["single_choice", "multiple_choice"];

function RegistrationFieldsPage() {
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<FieldDraft>(emptyField());
  const [newChoice, setNewChoice] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await registrationFieldsApi.list();
      setFields(result.map(({ id: _id, ...field }) => field));
      setSaved(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load registration fields.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const beginCreate = () => {
    setEditingIndex(null);
    setForm({ ...emptyField(), position: fields.length });
    setNewChoice("");
    setError(null);
    setOpen(true);
  };
  const beginEdit = (field: FieldDraft, index: number) => {
    setEditingIndex(index);
    setForm({ ...field, options: [...field.options] });
    setNewChoice("");
    setError(null);
    setOpen(true);
  };
  const updateForm = (change: Partial<FieldDraft>) => setForm((current) => ({ ...current, ...change }));
  const addChoice = () => {
    const choice = newChoice.trim();
    if (!choice) return;
    if (form.options.some((option) => option.trim().toLowerCase() === choice.toLowerCase())) {
      setError("That choice already exists. Enter a different choice.");
      return;
    }
    updateForm({ options: [...form.options, choice] });
    setNewChoice("");
    setError(null);
  };
  const move = (index: number, direction: -1 | 1) => {
    setFields((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((field, position) => ({ ...field, position }));
    });
    setSaved(false);
  };
  const saveField = (event: FormEvent) => {
    event.preventDefault();
    const key = form.key.trim();
    const options = form.options.map((option) => option.trim()).filter(Boolean);
    if (fields.some((field, index) => index !== editingIndex && field.key === key)) {
      setError("Each field needs a unique key. Choose a different key before saving.");
      return;
    }
    if (choiceKinds.includes(form.input_type) && !options.length) {
      setError("Add at least one choice for this field.");
      return;
    }
    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
      setError("Each choice needs a unique name. Edit or remove duplicates before saving.");
      return;
    }
    const cleaned = { ...form, key, label: form.label.trim(), options: choiceKinds.includes(form.input_type) ? options : [], position: editingIndex ?? fields.length };
    setFields((current) => editingIndex === null
      ? [...current, cleaned]
      : current.map((field, index) => index === editingIndex ? cleaned : field));
    setSaved(false);
    setError(null);
    setOpen(false);
  };
  const toggleActive = (index: number) => {
    setFields((current) => current.map((field, position) => position === index ? { ...field, is_active: !field.is_active } : field));
    setSaved(false);
  };
  const saveAll = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await registrationFieldsApi.replace(fields.map((field, position) => ({ ...field, position })));
      setFields(result.map(({ id: _id, ...field }) => field));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save registration fields.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-6">
    <PageHeader title="Registration fields" description="Choose what customers provide when creating an account. Required fields remain on the profile completion checklist until the customer supplies them." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading || saving}>Refresh</Button><Button onClick={beginCreate}><Plus className="mr-2 size-4" />Add field</Button></div>} />
    <Card className="border-blue-100 bg-blue-50/60 p-4 text-sm leading-6 text-slate-700">Phone verification creates the account. Customers can skip required details during signup and complete them later from their profile. Email is stored on the account and checked for uniqueness.</Card>
    {error && !open && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {saved && <p role="status" className="text-sm text-emerald-700">Registration fields saved.</p>}
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Field</TableHead><TableHead>Answer type</TableHead><TableHead>Requirement</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {fields.map((field, index) => <TableRow key={`${field.key}-${index}`}>
            <TableCell className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</TableCell>
            <TableCell><div className="font-medium">{field.label || "Untitled field"}</div><div className="mt-0.5 text-xs text-muted-foreground">{field.key || "key not set"}{choiceKinds.includes(field.input_type) && field.options.length ? ` · ${field.options.length} choices` : ""}</div></TableCell>
            <TableCell>{typeName(field.input_type)}</TableCell>
            <TableCell><Badge variant={field.required ? "default" : "secondary"}>{field.required ? "Required" : "Optional"}</Badge></TableCell>
            <TableCell><Badge variant={field.is_active ? "success" : "secondary"}>{field.is_active ? "Visible" : "Hidden"}</Badge></TableCell>
            <TableCell className="text-right"><div className="flex justify-end gap-1">
              <Button type="button" size="icon" variant="ghost" aria-label="Move field up" title="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
              <Button type="button" size="icon" variant="ghost" aria-label="Move field down" title="Move down" disabled={index === fields.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
              <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(field, index)}><Pencil className="mr-1 size-3.5" />Edit</Button>
              <Button type="button" size="icon" variant="ghost" aria-label={field.is_active ? "Hide field" : "Show field"} title={field.is_active ? "Hide field" : "Show field"} onClick={() => toggleActive(index)}><Power className={`size-4 ${field.is_active ? "" : "text-muted-foreground"}`} /></Button>
            </div></TableCell>
          </TableRow>)}
          {loading && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">Loading registration fields…</TableCell></TableRow>}
          {!loading && !fields.length && <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">No registration fields have been created. Add the details customers should provide.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">Changes are drafts until you save the registration form.</p>
      <Button disabled={saving || loading} onClick={() => void saveAll()}><Save className="mr-2 size-4" />{saving ? "Saving…" : "Save registration form"}</Button>
    </div>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editingIndex === null ? "Add registration field" : "Edit registration field"}</DialogTitle></DialogHeader>
        <form className="space-y-5" onSubmit={saveField}>
          {error && open && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="registration-label">Field label</Label><Input id="registration-label" value={form.label} placeholder="e.g. Email address" onChange={(event) => { const label = event.target.value; updateForm({ label, ...(form.key ? {} : { key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") }) }); }} required /></div>
            <div className="space-y-2"><Label htmlFor="registration-key">Field key</Label><Input id="registration-key" value={form.key} pattern="[a-z][a-z0-9_]*" title="Start with a lowercase letter; use lowercase letters, numbers, and underscores." placeholder="email_address" onChange={(event) => updateForm({ key: event.target.value })} required /><p className="text-xs text-muted-foreground">A stable identifier used to save the answer.</p></div>
            <div className="space-y-2"><Label htmlFor="registration-type">Answer type</Label><select id="registration-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.input_type} onChange={(event) => updateForm({ input_type: event.target.value as RegistrationField["input_type"], options: choiceKinds.includes(event.target.value as RegistrationField["input_type"]) ? form.options : [] })}>{kinds.map((kind) => <option key={kind} value={kind}>{typeName(kind)}</option>)}</select><p className="text-xs text-muted-foreground">Dropdown lets the customer choose one option; multiple choice allows several selections.</p></div>
            <div className="space-y-2"><Label htmlFor="registration-help">Help text <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="registration-help" value={form.help_text ?? ""} placeholder="Guidance shown below the field" onChange={(event) => updateForm({ help_text: event.target.value || null })} /></div>
          </div>
          {choiceKinds.includes(form.input_type) && <div className="space-y-3"><div><Label>Choices</Label><p className="mt-1 text-xs text-muted-foreground">Add each option separately. Edit its text or remove it at any time.</p></div>
            <div className="space-y-2">{form.options.map((option, index) => <div key={index} className="flex items-center gap-2"><Input aria-label={`Choice ${index + 1}`} value={option} placeholder={`Choice ${index + 1}`} onChange={(event) => setForm((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} /><Button type="button" size="icon" variant="ghost" aria-label={`Remove choice ${index + 1}`} title="Remove choice" onClick={() => updateForm({ options: form.options.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="size-4 text-destructive" /></Button></div>)}</div>
            <div className="flex gap-2"><Input aria-label="New choice" value={newChoice} placeholder="Add a choice" onChange={(event) => setNewChoice(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addChoice(); } }} /><Button type="button" variant="outline" onClick={addChoice}><Plus className="mr-1 size-4" />Add choice</Button></div>
          </div>}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Required</p><p className="text-xs text-muted-foreground">Customers who skip it must complete it from their profile.</p></div><Switch checked={form.required} onCheckedChange={(required) => updateForm({ required })} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Visible on registration</p><p className="text-xs text-muted-foreground">Hidden fields are excluded from signup and profile completion.</p></div><Switch checked={form.is_active} onCheckedChange={(is_active) => updateForm({ is_active })} /></div>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button>{editingIndex === null ? "Add field" : "Apply changes"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
