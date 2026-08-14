import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Pencil, Plus, Power } from "lucide-react";
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
import { propertyTypesApi, type PropertyType, type PropertyTypeField } from "@/lib/api";

export const Route = createFileRoute("/_dash/property-types")({ component: PropertyTypesPage });

const pricingSizes = ["studio", "one_bedroom", "two_bedroom", "three_bedroom", "four_plus_bedroom", "small_office", "medium_office", "large_office", "custom"];
const emptyForm = () => ({ name: "", pricing_property_size: "studio", is_active: true, fields: [] as PropertyTypeField[] });
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function PropertyTypesPage() {
  const [items, setItems] = useState<PropertyType[]>([]);
  const [editing, setEditing] = useState<PropertyType | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => { try { setError(null); setItems(await propertyTypesApi.list()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load property types."); } };
  useEffect(() => { void load(); }, []);
  const beginCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const beginEdit = (item: PropertyType) => { setEditing(item); setForm({ name: item.name, pricing_property_size: item.pricing_property_size, is_active: item.is_active, fields: item.fields }); setOpen(true); };
  const updateField = (index: number, change: Partial<PropertyTypeField>) => setForm((current) => ({ ...current, fields: current.fields.map((field, position) => position === index ? { ...field, ...change } : field) }));
  const moveField = (index: number, direction: -1 | 1) => setForm((current) => { const next = [...current.fields]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return { ...current, fields: next }; });
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      if (editing) {
        const changes = Object.fromEntries(Object.entries(form).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(editing[key as keyof typeof form]))) as Partial<typeof form>;
        if (Object.keys(changes).length) await propertyTypesApi.update(editing.id, changes);
      } else await propertyTypesApi.create(form);
      setOpen(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save property type."); } finally { setSaving(false); }
  };

  return <div className="space-y-6">
    <PageHeader title="Property Types" description="Map each property category to pricing and define the booking questions shown for it." actions={<div className="flex gap-2"><Button variant="outline" onClick={() => void load()}>Refresh</Button><Button onClick={beginCreate}><Plus className="mr-2 size-4" />Add property type</Button></div>} />
    {error && <p className="text-sm text-destructive">{error}</p>}
    <Card className="overflow-hidden p-0"><Table><TableHeader><TableRow><TableHead>Property type</TableHead><TableHead>Pricing category</TableHead><TableHead>Booking fields</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
      {items.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.name}</TableCell><TableCell>{pretty(item.pricing_property_size)}</TableCell><TableCell>{item.fields.length ? item.fields.map((field) => field.label).join(", ") : "No extra questions"}</TableCell><TableCell><Badge variant={item.is_active ? "success" : "secondary"}>{item.is_active ? "Active" : "Inactive"}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => beginEdit(item)}><Pencil className="mr-1 size-3.5" />Edit</Button><Button size="sm" variant="outline" disabled={!item.is_active} onClick={() => { if (window.confirm(`Deactivate ${item.name}? It will remain available in booking history.`)) void propertyTypesApi.deactivate(item.id).then(load).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to deactivate property type.")); }}><Power className="mr-1 size-3.5" />Deactivate</Button></div></TableCell></TableRow>)}
      {!items.length && <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No property types have been created.</TableCell></TableRow>}
    </TableBody></Table></Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Edit property type" : "Add property type"}</DialogTitle></DialogHeader><form className="space-y-5" onSubmit={save}>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="property-name">Name</Label><Input id="property-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Office" required /></div><div className="space-y-2"><Label htmlFor="pricing-size">Pricing category</Label><select id="pricing-size" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.pricing_property_size} onChange={(event) => setForm({ ...form, pricing_property_size: event.target.value })}>{pricingSizes.map((size) => <option key={size} value={size}>{pretty(size)}</option>)}</select></div></div>
      <div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Active</p><p className="text-xs text-muted-foreground">Only active types are available for new bookings.</p></div><Switch checked={form.is_active} onCheckedChange={(is_active) => setForm({ ...form, is_active })} /></div>
      <div className="space-y-3"><div className="flex items-center justify-between"><div><h3 className="font-medium">Booking questions</h3><p className="text-xs text-muted-foreground">These are shown in the displayed order after this property type is selected.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, fields: [...form.fields, { key: "", label: "", type: "number", required: false }] })}><Plus className="mr-1 size-3.5" />Add question</Button></div>
        {form.fields.map((field, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_1fr_130px_auto_auto]"><Input value={field.label} placeholder="Question label" onChange={(event) => updateField(index, { label: event.target.value })} required /><Input value={field.key} placeholder="field_key" pattern="[a-z][a-z0-9_]{0,79}" onChange={(event) => updateField(index, { key: event.target.value })} required /><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={field.type} onChange={(event) => updateField(index, { type: event.target.value as PropertyTypeField["type"] })}>{["number", "text", "select", "boolean"].map((type) => <option key={type}>{pretty(type)}</option>)}</select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} />Required</label><div className="flex gap-1"><Button type="button" size="icon" variant="ghost" aria-label="Move question up" disabled={index === 0} onClick={() => moveField(index, -1)}><ArrowUp className="size-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label="Move question down" disabled={index === form.fields.length - 1} onClick={() => moveField(index, 1)}><ArrowDown className="size-4" /></Button><Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setForm({ ...form, fields: form.fields.filter((_, position) => position !== index) })}>Remove</Button></div></div>)}
        {!form.fields.length && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No additional booking questions. Add fields such as rooms, bathrooms, floor area, or workstations.</p>}
      </div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create property type"}</Button></div>
    </form></DialogContent></Dialog>
  </div>;
}
