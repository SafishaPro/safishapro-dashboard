import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isUploadWithinLimit, MEDIA_UPLOAD_MAX_BYTES, servicesApi, type Service, type ServiceAddon, type ServicePackage } from "@/lib/api";
import { Check, ChevronLeft, ChevronRight, PackageOpen, Puzzle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_dash/services")({ component: ServicesPage });

const readable = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const packageColour = (pricingModel: string) => ({
  fixed: "border-blue-200 bg-blue-50",
  hourly: "border-violet-200 bg-violet-50",
  per_room: "border-emerald-200 bg-emerald-50",
  per_square_metre: "border-amber-200 bg-amber-50",
  tiered: "border-rose-200 bg-rose-50",
}[pricingModel] ?? "border-slate-200 bg-slate-50");

const emptyService = {
  name: "",
  base_price: "",
  estimated_duration_minutes: "",
  description: "",
};

const emptyAddon = {
  name: "",
  description: "",
  rate: "",
  currency: "KES",
  applies_per_session: true,
  maximum_quantity: "",
};

const emptyPackage = {
  name: "",
  description: "",
  price: "",
  currency: "KES",
  pricing_model: "fixed",
  billing_cycle: "one_time",
  visits_per_cycle: "",
  commitment_cycles: "",
  included_items: "",
};

function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creationStep, setCreationStep] = useState<1 | 2 | 3>(1);
  const [savingCreation, setSavingCreation] = useState(false);
  const [serviceImage, setServiceImage] = useState<File | null>(null);
  const [draftServiceId, setDraftServiceId] = useState<string | null>(null);
  const [creatingAddon, setCreatingAddon] = useState(false);
  const [creatingPackage, setCreatingPackage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyService);
  const [addonForm, setAddonForm] = useState(emptyAddon);
  const [addon, setAddon] = useState<ServiceAddon | null>(null);
  const [packageItem, setPackageItem] = useState<ServicePackage | null>(null);
  const [packageForm, setPackageForm] = useState(emptyPackage);

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      setError(null);
      setServices(await servicesApi.list(true));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load services.");
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => { void loadCatalog(); }, []);

  const beginCreate = () => {
    setForm(emptyService);
    setServiceImage(null);
    setDraftServiceId(null);
    setPackageForm(emptyPackage);
    setAddonForm(emptyAddon);
    setService(null);
    setCreationStep(1);
    setError(null);
    setCreating(true);
  };

  const closeCreation = async () => {
    setCreating(false);
    setCreationStep(1);
    setService(null);
    setServiceImage(null);
    setDraftServiceId(null);
    setPackageForm(emptyPackage);
    setAddonForm(emptyAddon);
    await loadCatalog();
  };

  const saveService = async (event: FormEvent) => {
    event.preventDefault();
    setSavingCreation(true);
    try {
      if (creating) {
        if (!serviceImage) throw new Error("Choose an image for this service.");
        const payload = {
          name: form.name,
          base_price: Number(form.base_price),
          estimated_duration_minutes: Number(form.estimated_duration_minutes),
          description: form.description || undefined,
        };
        const created = draftServiceId
          ? await servicesApi.update(draftServiceId, payload)
          : await servicesApi.create(payload);
        if (!draftServiceId) setDraftServiceId(created.id);
        const withImage = await servicesApi.uploadImage(created.id, serviceImage);
        setService(withImage);
        setDraftServiceId(null);
        setCreationStep(2);
      } else if (service) {
        const next = await servicesApi.update(service.id, {
          name: form.name,
          description: form.description || null,
          base_price: Number(form.base_price),
          estimated_duration_minutes: Number(form.estimated_duration_minutes),
        });
        const updated = serviceImage
          ? await servicesApi.uploadImage(next.id, serviceImage)
          : next;
        setService(updated);
        setServiceImage(null);
        setEditing(false);
        await loadCatalog();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save service.");
    } finally {
      setSavingCreation(false);
    }
  };

  const addWizardPackage = async (event: FormEvent) => {
    event.preventDefault();
    if (!service) return;
    setSavingCreation(true);
    try {
      setError(null);
      const created = await servicesApi.createPackage(service.id, {
        name: packageForm.name,
        description: packageForm.description || undefined,
        price: Number(packageForm.price),
        currency: packageForm.currency,
        pricing_model: packageForm.pricing_model,
        billing_cycle: packageForm.billing_cycle,
        visits_per_cycle: packageForm.visits_per_cycle ? Number(packageForm.visits_per_cycle) : undefined,
        commitment_cycles: packageForm.commitment_cycles ? Number(packageForm.commitment_cycles) : undefined,
        included_items: packageForm.included_items.split(",").map((item) => item.trim()).filter(Boolean),
        is_active: true,
      });
      setService({ ...service, packages: [...service.packages, created] });
      setPackageForm(emptyPackage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save service package.");
    } finally {
      setSavingCreation(false);
    }
  };

  const addWizardAddon = async (event: FormEvent) => {
    event.preventDefault();
    if (!service) return;
    setSavingCreation(true);
    try {
      setError(null);
      await servicesApi.createAddon(service.id, {
        name: addonForm.name,
        description: addonForm.description || undefined,
        rate: Number(addonForm.rate),
        currency: addonForm.currency,
        applies_per_session: addonForm.applies_per_session,
        maximum_quantity: addonForm.maximum_quantity ? Number(addonForm.maximum_quantity) : undefined,
        is_active: true,
      });
      setService(await servicesApi.get(service.id));
      setAddonForm(emptyAddon);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create add-on.");
    } finally {
      setSavingCreation(false);
    }
  };

  const editService = (item: Service) => {
    setService(item);
    setServiceImage(null);
    setForm({
      name: item.name,
      slug: item.slug,
      base_price: String(item.base_price),
      estimated_duration_minutes: String(item.estimated_duration_minutes),
      description: item.description || "",
    });
    setEditing(true);
  };

  const replaceServiceImage = async (image: File) => {
    if (!service) return;
    try {
      const updated = await servicesApi.uploadImage(service.id, image);
      setService(updated);
      setServices((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to replace service image.");
      throw cause;
    }
  };

  const createAddon = async (event: FormEvent) => {
    event.preventDefault();
    if (!service) return;
    try {
      const payload = {
        name: addonForm.name,
        description: addonForm.description || undefined,
        rate: Number(addonForm.rate),
        currency: addonForm.currency,
        applies_per_session: addonForm.applies_per_session,
        maximum_quantity: addonForm.maximum_quantity ? Number(addonForm.maximum_quantity) : undefined,
        is_active: true,
      };
      if (addon) await servicesApi.updateAddon(service.id, addon.id, payload);
      else await servicesApi.createAddon(service.id, payload);
      setCreatingAddon(false);
      setAddonForm(emptyAddon);
      setAddon(null);
      const catalog = await servicesApi.list(true);
      setServices(catalog);
      const updated = catalog.find((item) => item.id === service.id);
      if (updated) setService(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create add-on.");
    }
  };

  const savePackage = async (event: FormEvent) => {
    event.preventDefault();
    if (!service) return;
    try {
      const payload = {
        name: packageForm.name,
        description: packageForm.description || undefined,
        price: Number(packageForm.price),
        currency: packageForm.currency,
        pricing_model: packageForm.pricing_model,
        billing_cycle: packageForm.billing_cycle,
        visits_per_cycle: packageForm.visits_per_cycle ? Number(packageForm.visits_per_cycle) : undefined,
        commitment_cycles: packageForm.commitment_cycles ? Number(packageForm.commitment_cycles) : undefined,
        included_items: packageForm.included_items.split(",").map((item) => item.trim()).filter(Boolean),
        is_active: true,
      };
      if (packageItem) await servicesApi.updatePackage(service.id, packageItem.id, payload);
      else await servicesApi.createPackage(service.id, payload);
      setCreatingPackage(false);
      setPackageItem(null);
      setPackageForm(emptyPackage);
      const catalog = await servicesApi.list(true);
      setServices(catalog);
      const updated = catalog.find((item) => item.id === service.id);
      if (updated) setService(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save service package.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Manage your service catalogue, packages, and optional add-ons."
        actions={
          <>
            <Button onClick={beginCreate}>Create service</Button>
            <Button variant="outline" onClick={() => void loadCatalog()}>Refresh</Button>
          </>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Service</TableHead><TableHead>Base price</TableHead><TableHead>Duration</TableHead><TableHead>Packages</TableHead><TableHead>Add-ons</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {services.map((item, index) => <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</TableCell>
                  <TableCell><div className="flex items-center gap-3">{item.image_url ? <img src={item.image_url} alt={item.name} className="size-12 rounded-md object-cover" /> : <div className="size-12 rounded-md border bg-muted" aria-label="No service image" />}<div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.description || item.slug}</p></div></div></TableCell>
                  <TableCell>KES {Number(item.base_price).toLocaleString()}</TableCell>
                  <TableCell>{item.estimated_duration_minutes} min</TableCell>
                  <TableCell>{item.packages.length}</TableCell>
                  <TableCell>{item.additional_services.length}</TableCell>
                  <TableCell><Badge variant={item.is_active ? "success" : "destructive"}>{item.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-2">
                    <Button size="sm" className="bg-blue-950 text-white hover:bg-blue-900" onClick={() => { setService(item); setEditing(false); }}>View details</Button>
                    <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => editService(item)}>Edit</Button>
                    <Button size="sm" variant="destructive" disabled={!item.is_active} onClick={async () => {
                      if (window.confirm(`Deactivate ${item.name}?`)) {
                        try { await servicesApi.deactivate(item.id); await load(); }
                        catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to deactivate service."); }
                      }
                    }}>Deactivate</Button>
                  </div></TableCell>
                </TableRow>)}
                {!services.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">{loadingCatalog ? "Loading services…" : error ? "Services could not be loaded. Use Refresh to try again." : "No services found."}</TableCell></TableRow>}
              </TableBody>
            </Table>
      </Card>

      <Dialog open={creating || Boolean(service)} onOpenChange={(open) => {
        if (!open) {
          if (creating) void closeCreation();
          else { setService(null); setEditing(false); }
        }
      }}>
        <DialogContent className={creating ? "max-h-[92vh] max-w-4xl overflow-y-auto p-0" : "max-h-[85vh] max-w-2xl overflow-y-auto"}>
          {creating ? <div>
            <div className="border-b bg-muted/30 px-6 py-5 pr-12">
              <DialogHeader>
                <DialogTitle>Create a service</DialogTitle>
                <p className="text-sm text-muted-foreground">Set up the service, add at least one package, then choose whether to offer extras.</p>
              </DialogHeader>
              <CreationStepper step={creationStep} />
            </div>

            <div className="px-6 py-6">
              {error && <div role="alert" className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

              {creationStep === 1 && <form className="space-y-6" onSubmit={saveService}>
                <div>
                  <h3 className="font-semibold">Service details</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Start with the information customers and staff need to identify this service.</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Field label="Service name" hint="Use a short, recognizable name."><Input placeholder="e.g. Standard home cleaning" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required autoFocus /></Field></div>
                  <Field label="Base price (KES)" hint="The starting price before package rules."><Input type="number" min="0" step="0.01" placeholder="0.00" value={form.base_price} onChange={(event) => setForm({ ...form, base_price: event.target.value })} required /></Field>
                  <Field label="Estimated duration" hint="Enter the average duration in minutes."><div className="relative"><Input className="pr-20" type="number" min="1" placeholder="120" value={form.estimated_duration_minutes} onChange={(event) => setForm({ ...form, estimated_duration_minutes: event.target.value })} required /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">minutes</span></div></Field>
                  <div className="sm:col-span-2"><Field label="Description" hint="Explain what the service covers. You can refine this later."><Textarea rows={4} placeholder="Describe the service and who it is for…" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
                  <div className="sm:col-span-2"><Field label="Service image *" hint="Choose a JPEG, PNG, or WebP image up to 10 MB. It uploads when you continue."><Input type="file" accept="image/jpeg,image/png,image/webp" required={!serviceImage} onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && !isUploadWithinLimit(file, MEDIA_UPLOAD_MAX_BYTES, "Service image")) { event.currentTarget.value = ""; setServiceImage(null); return; } setServiceImage(file); }} />{serviceImage && <><p className="mt-2 text-xs text-muted-foreground">Selected: {serviceImage.name}</p><ServiceImagePreview file={serviceImage} /></>}</Field></div>
                </div>
                <WizardFooter onCancel={() => void closeCreation()} cancelLabel="Cancel" nextLabel="Continue to packages" busy={savingCreation} />
              </form>}

              {creationStep === 2 && service && <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-semibold">Create packages</h3><p className="mt-1 text-sm text-muted-foreground">Packages define how customers can purchase {service.name}. Add at least one to continue.</p></div>
                  <Badge variant={service.packages.length ? "success" : "secondary"}>{service.packages.length} {service.packages.length === 1 ? "package" : "packages"} added</Badge>
                </div>
                <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
                  <form className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2" onSubmit={addWizardPackage}>
                    <div className="sm:col-span-2"><p className="font-medium">Package information</p><p className="text-xs text-muted-foreground">Save this package, then add another if needed.</p></div>
                    <Field label="Package name"><Input placeholder="e.g. One-time clean" value={packageForm.name} onChange={(event) => setPackageForm({ ...packageForm, name: event.target.value })} required /></Field>
                    <Field label="Price"><Input type="number" min="0" step="0.01" placeholder="0.00" value={packageForm.price} onChange={(event) => setPackageForm({ ...packageForm, price: event.target.value })} required /></Field>
                    <Field label="Pricing model"><select value={packageForm.pricing_model} onChange={(event) => setPackageForm({ ...packageForm, pricing_model: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="fixed">Fixed price</option><option value="hourly">Per hour</option><option value="per_room">Per room</option><option value="per_square_metre">Per square metre</option><option value="tiered">Tiered</option></select></Field>
                    <Field label="Billing cycle"><select value={packageForm.billing_cycle} onChange={(event) => setPackageForm({ ...packageForm, billing_cycle: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="one_time">One time</option><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="semi_annual">Semi-annual</option></select></Field>
                    <Field label="Visits per cycle" hint="Optional for recurring packages."><Input type="number" min="1" placeholder="e.g. 4" value={packageForm.visits_per_cycle} onChange={(event) => setPackageForm({ ...packageForm, visits_per_cycle: event.target.value })} /></Field>
                    <Field label="Minimum commitment" hint="Optional number of billing cycles."><Input type="number" min="1" placeholder="e.g. 3" value={packageForm.commitment_cycles} onChange={(event) => setPackageForm({ ...packageForm, commitment_cycles: event.target.value })} /></Field>
                    <div className="sm:col-span-2"><Field label="Description"><Textarea rows={2} placeholder="What makes this package different?" value={packageForm.description} onChange={(event) => setPackageForm({ ...packageForm, description: event.target.value })} /></Field></div>
                    <div className="sm:col-span-2"><Field label="What's included?" hint="Separate items with commas."><Input placeholder="Surface cleaning, Floors, Bathroom" value={packageForm.included_items} onChange={(event) => setPackageForm({ ...packageForm, included_items: event.target.value })} /></Field></div>
                    <div className="sm:col-span-2"><Button type="submit" variant="outline" disabled={savingCreation}><PackageOpen className="mr-2 size-4" />{savingCreation ? "Adding package…" : "Add package"}</Button></div>
                  </form>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Added packages</p>
                    {service.packages.map((item) => <div key={item.id} className={`rounded-xl border p-4 ${packageColour(item.pricing_model)}`}><p className="font-semibold">{item.name}</p><p className="mt-1 text-lg font-bold">{item.currency} {Number(item.price).toLocaleString()}</p><p className="mt-2 text-xs text-muted-foreground">{readable(item.pricing_model)} · {readable(item.billing_cycle)}</p></div>)}
                    {!service.packages.length && <div className="rounded-xl border border-dashed p-6 text-center"><PackageOpen className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No packages yet</p><p className="mt-1 text-xs text-muted-foreground">Complete the form to add your first package.</p></div>}
                  </div>
                </div>
                <WizardFooter onBack={() => setCreationStep(1)} onCancel={() => void closeCreation()} nextLabel="Continue to add-ons" onNext={() => setCreationStep(3)} nextDisabled={!service.packages.length} />
              </div>}

              {creationStep === 3 && service && <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2"><h3 className="font-semibold">Add-ons</h3><Badge variant="secondary">Optional</Badge></div><p className="mt-1 text-sm text-muted-foreground">Offer extras customers can add to {service.name}. Skip this step if none are needed.</p></div>
                  <Badge variant={service.additional_services.length ? "success" : "secondary"}>{service.additional_services.length} added</Badge>
                </div>
                <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
                  <form className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2" onSubmit={addWizardAddon}>
                    <div className="sm:col-span-2"><p className="font-medium">Add-on information</p><p className="text-xs text-muted-foreground">Save an add-on, then create another if needed.</p></div>
                    <Field label="Add-on name"><Input placeholder="e.g. Inside oven cleaning" value={addonForm.name} onChange={(event) => setAddonForm({ ...addonForm, name: event.target.value })} required /></Field>
                    <Field label="Rate (KES)"><Input type="number" min="0" step="0.01" placeholder="0.00" value={addonForm.rate} onChange={(event) => setAddonForm({ ...addonForm, rate: event.target.value })} required /></Field>
                    <Field label="Maximum quantity" hint="Optional customer limit."><Input type="number" min="1" max="100" placeholder="No limit" value={addonForm.maximum_quantity} onChange={(event) => setAddonForm({ ...addonForm, maximum_quantity: event.target.value })} /></Field>
                    <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addonForm.applies_per_session} onChange={(event) => setAddonForm({ ...addonForm, applies_per_session: event.target.checked })} /> Charge for every service session</label></div>
                    <div className="sm:col-span-2"><Field label="Description"><Textarea rows={2} placeholder="Describe what this add-on includes…" value={addonForm.description} onChange={(event) => setAddonForm({ ...addonForm, description: event.target.value })} /></Field></div>
                    <div className="sm:col-span-2"><Button type="submit" variant="outline" disabled={savingCreation}><Puzzle className="mr-2 size-4" />{savingCreation ? "Adding add-on…" : "Add add-on"}</Button></div>
                  </form>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Added add-ons</p>
                    {service.additional_services.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{item.name}</p><Badge variant="secondary">{item.applies_per_session ? "Per session" : "Once"}</Badge></div><p className="mt-1 text-base font-bold">{item.currency} {Number(item.rate).toLocaleString()}</p>{item.description && <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>}</div>)}
                    {!service.additional_services.length && <div className="rounded-xl border border-dashed p-6 text-center"><Puzzle className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No add-ons</p><p className="mt-1 text-xs text-muted-foreground">This step is optional. You can add extras later.</p></div>}
                  </div>
                </div>
                <WizardFooter onBack={() => setCreationStep(2)} onCancel={() => void closeCreation()} nextLabel={service.additional_services.length ? "Finish setup" : "Skip and finish"} onNext={() => void closeCreation()} />
              </div>}
            </div>
          </div> : <>
            <DialogHeader><DialogTitle>{editing ? "Edit service" : "Service details"}</DialogTitle></DialogHeader>
            {editing ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveService}>
              <Field label="Service name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
              <Field label="Base price"><Input type="number" min="0" value={form.base_price} onChange={(event) => setForm({ ...form, base_price: event.target.value })} required /></Field>
              <Field label="Duration (minutes)"><Input type="number" min="1" value={form.estimated_duration_minutes} onChange={(event) => setForm({ ...form, estimated_duration_minutes: event.target.value })} required /></Field>
              <div className="sm:col-span-2"><Field label="Description"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Replace service image (optional)" hint="JPEG, PNG, or WebP; up to 10 MB."><Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && !isUploadWithinLimit(file, MEDIA_UPLOAD_MAX_BYTES, "Service image")) { event.currentTarget.value = ""; setServiceImage(null); return; } setServiceImage(file); }} />{serviceImage && <><p className="mt-2 text-xs text-muted-foreground">Selected: {serviceImage.name}</p><ServiceImagePreview file={serviceImage} /></>}</Field></div>
              <div className="sm:col-span-2 flex gap-2"><Button>Save changes</Button><Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button></div>
            </form> : service && <ServiceDetails key={service.id} service={service} onReplaceImage={replaceServiceImage} onCreateAddon={() => { setAddon(null); setAddonForm(emptyAddon); setCreatingAddon(true); }} onEditAddon={(item) => { setAddon(item); setAddonForm({ name: item.name, description: item.description || "", rate: String(item.rate), currency: item.currency, applies_per_session: item.applies_per_session, maximum_quantity: item.maximum_quantity ? String(item.maximum_quantity) : "" }); }} onCreatePackage={() => { setPackageItem(null); setPackageForm(emptyPackage); setCreatingPackage(true); }} onEditPackage={(item) => { setPackageItem(item); setPackageForm({ name: item.name, description: item.description || "", price: String(item.price), currency: item.currency, pricing_model: item.pricing_model, billing_cycle: item.billing_cycle, visits_per_cycle: item.visits_per_cycle ? String(item.visits_per_cycle) : "", commitment_cycles: item.commitment_cycles ? String(item.commitment_cycles) : "", included_items: item.included_items?.join(", ") || "" }); }} />}
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={creatingAddon || Boolean(addon)} onOpenChange={(open) => { if (!open) { setCreatingAddon(false); setAddon(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{addon ? "Edit add-on" : "Create add-on"}</DialogTitle></DialogHeader>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={createAddon}>
            <Field label="Add-on name"><Input value={addonForm.name} onChange={(event) => setAddonForm({ ...addonForm, name: event.target.value })} required /></Field>
            <Field label="Rate"><Input type="number" min="0" step="0.01" value={addonForm.rate} onChange={(event) => setAddonForm({ ...addonForm, rate: event.target.value })} required /></Field>
            <Field label="Currency"><Input value={addonForm.currency} maxLength={3} onChange={(event) => setAddonForm({ ...addonForm, currency: event.target.value.toUpperCase() })} required /></Field>
            <Field label="Maximum quantity (optional)"><Input type="number" min="1" max="100" value={addonForm.maximum_quantity} onChange={(event) => setAddonForm({ ...addonForm, maximum_quantity: event.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Description (optional)"><Input value={addonForm.description} onChange={(event) => setAddonForm({ ...addonForm, description: event.target.value })} /></Field></div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={addonForm.applies_per_session} onChange={(event) => setAddonForm({ ...addonForm, applies_per_session: event.target.checked })} /> Apply this rate to every service session</label>
            <div className="sm:col-span-2 flex gap-2"><Button>{addon ? "Save add-on" : "Create add-on"}</Button><Button type="button" variant="outline" onClick={() => { setCreatingAddon(false); setAddon(null); }}>Cancel</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={creatingPackage || Boolean(packageItem)} onOpenChange={(open) => { if (!open) { setCreatingPackage(false); setPackageItem(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{packageItem ? "Edit service package" : "Create service package"}</DialogTitle></DialogHeader>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={savePackage}>
            <Field label="Package name"><Input value={packageForm.name} onChange={(event) => setPackageForm({ ...packageForm, name: event.target.value })} required /></Field>
            <Field label="Price"><Input type="number" min="0" step="0.01" value={packageForm.price} onChange={(event) => setPackageForm({ ...packageForm, price: event.target.value })} required /></Field>
            <Field label="Currency"><Input value={packageForm.currency} maxLength={3} onChange={(event) => setPackageForm({ ...packageForm, currency: event.target.value.toUpperCase() })} required /></Field>
            <Field label="Pricing model"><select value={packageForm.pricing_model} onChange={(event) => setPackageForm({ ...packageForm, pricing_model: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="fixed">Fixed</option><option value="hourly">Hourly</option><option value="per_room">Per room</option><option value="per_square_metre">Per square metre</option><option value="tiered">Tiered</option></select></Field>
            <Field label="Billing cycle"><select value={packageForm.billing_cycle} onChange={(event) => setPackageForm({ ...packageForm, billing_cycle: event.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="one_time">One time</option><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="semi_annual">Semi-annual</option></select></Field>
            <Field label="Visits per cycle"><Input type="number" min="1" value={packageForm.visits_per_cycle} onChange={(event) => setPackageForm({ ...packageForm, visits_per_cycle: event.target.value })} /></Field>
            <Field label="Commitment cycles"><Input type="number" min="1" value={packageForm.commitment_cycles} onChange={(event) => setPackageForm({ ...packageForm, commitment_cycles: event.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Description (optional)"><Input value={packageForm.description} onChange={(event) => setPackageForm({ ...packageForm, description: event.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Included items (comma separated)"><Input placeholder="e.g. Surface cleaning, Floor cleaning" value={packageForm.included_items} onChange={(event) => setPackageForm({ ...packageForm, included_items: event.target.value })} /></Field></div>
            <div className="sm:col-span-2 flex gap-2"><Button>{packageItem ? "Save package" : "Create package"}</Button><Button type="button" variant="outline" onClick={() => { setCreatingPackage(false); setPackageItem(null); }}>Cancel</Button></div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

const creationSteps = [
  { number: 1 as const, label: "Service details", icon: Sparkles },
  { number: 2 as const, label: "Packages", icon: PackageOpen },
  { number: 3 as const, label: "Add-ons", icon: Puzzle, optional: true },
];

function CreationStepper({ step }: { step: 1 | 2 | 3 }) {
  return <ol aria-label="Service creation progress" className="mt-5 grid grid-cols-3 gap-2">
    {creationSteps.map((item) => {
      const complete = step > item.number;
      const active = step === item.number;
      const Icon = item.icon;
      return <li key={item.number} aria-current={active ? "step" : undefined} className="relative">
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ${active ? "border-primary bg-primary/5 text-primary" : complete ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-transparent text-muted-foreground"}`}>
          <span className={`grid size-7 shrink-0 place-items-center rounded-full ${active ? "bg-primary text-primary-foreground" : complete ? "bg-emerald-600 text-white" : "bg-muted"}`}>
            {complete ? <Check className="size-4" /> : <Icon className="size-4" />}
          </span>
          <span className="min-w-0"><span className="block truncate text-xs font-semibold sm:text-sm">{item.label}</span>{item.optional && <span className="hidden text-[11px] opacity-75 sm:block">Optional</span>}</span>
        </div>
      </li>;
    })}
  </ol>;
}

function WizardFooter({ onBack, onCancel, onNext, nextLabel, nextDisabled = false, busy = false, cancelLabel = "Save and close" }: { onBack?: () => void; onCancel: () => void; onNext?: () => void; nextLabel: string; nextDisabled?: boolean; busy?: boolean; cancelLabel?: string }) {
  return <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex gap-2">
      {onBack && <Button type="button" variant="outline" onClick={onBack}><ChevronLeft className="mr-1 size-4" />Back</Button>}
      <Button type="button" variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
    </div>
    <Button type={onNext ? "button" : "submit"} disabled={nextDisabled || busy} onClick={onNext}>
      {busy ? "Saving…" : nextLabel}{!busy && <ChevronRight className="ml-1 size-4" />}
    </Button>
  </div>;
}

function ServiceDetails({ service, onReplaceImage, onCreateAddon, onEditAddon, onCreatePackage, onEditPackage }: { service: Service; onReplaceImage: (image: File) => Promise<void>; onCreateAddon: () => void; onEditAddon: (item: ServiceAddon) => void; onCreatePackage: () => void; onEditPackage: (item: ServicePackage) => void }) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const submitImage = async (event: FormEvent) => {
    event.preventDefault();
    if (!imageFile) return;
    setUploadingImage(true);
    setImageError(null);
    try {
      await onReplaceImage(imageFile);
      setImageFile(null);
    } catch (cause) {
      setImageError(cause instanceof Error ? cause.message : "Unable to replace service image.");
    } finally {
      setUploadingImage(false);
    }
  };
  return <div className="space-y-4">
    <section className="space-y-3 rounded-lg border p-3"><div className="flex items-center justify-between"><h3 className="font-medium">Service image</h3><span className="text-xs text-muted-foreground">{service.image_url ? "Uploaded" : "No image yet"}</span></div>{service.image_url ? <img src={service.image_url} alt={service.name} className="max-h-64 w-full rounded-lg object-cover" /> : <div className="grid h-36 place-items-center rounded-lg bg-muted text-sm text-muted-foreground">No service image uploaded</div>}<form className="flex flex-wrap items-center gap-2" onSubmit={submitImage}><Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && !isUploadWithinLimit(file, MEDIA_UPLOAD_MAX_BYTES, "Service image")) { event.currentTarget.value = ""; setImageFile(null); return; } setImageFile(file); }} /><Button type="submit" size="sm" disabled={!imageFile || uploadingImage}>{uploadingImage ? "Uploading…" : service.image_url ? "Replace image" : "Upload image"}</Button></form>{imageError && <p role="alert" className="text-sm text-destructive">{imageError}</p>}</section>
    <div className="grid grid-cols-2 gap-3 text-sm">
      {[["Name", service.name], ["Slug", service.slug], ["Base price", `KES ${Number(service.base_price).toLocaleString()}`], ["Duration", `${service.estimated_duration_minutes} minutes`]].map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>)}
    </div>
    <p className="text-sm">{service.description || "No description"}</p>
    <div><div className="mb-2 flex items-center justify-between"><h3 className="font-medium">Packages</h3><Button size="sm" onClick={onCreatePackage}>Create package</Button></div><div className="grid gap-3 sm:grid-cols-2">{service.packages.map((item) => <div key={item.id} className={`rounded-lg border p-3 text-sm ${packageColour(item.pricing_model)}`}><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-lg font-bold">{item.currency} {Number(item.price).toLocaleString()}</p></div><Badge variant={item.is_active ? "success" : "secondary"}>{item.is_active ? "Active" : "Inactive"}</Badge></div><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{readable(item.pricing_model)} · {readable(item.billing_cycle)}</span><Button size="sm" variant="outline" onClick={() => onEditPackage(item)}>Edit</Button></div></div>)}{!service.packages.length && <p className="text-sm text-muted-foreground">No packages configured.</p>}</div></div>
    <div><div className="mb-2 flex items-center justify-between"><h3 className="font-medium">Add-ons</h3><Button size="sm" onClick={onCreateAddon}>Create add-on</Button></div><div className="space-y-2">{service.additional_services.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded border p-3 text-sm"><div><p className="font-medium">{item.name} <span className="font-normal text-muted-foreground">· {item.currency} {Number(item.rate).toLocaleString()} {item.applies_per_session ? "per session" : "once"}</span></p>{item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}</div><Button size="sm" variant="outline" onClick={() => onEditAddon(item)}>Edit</Button></div>)}{!service.additional_services.length && <p className="text-sm text-muted-foreground">No add-ons configured.</p>}</div></div>
  </div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div><Label>{label}</Label><div className="mt-1">{children}</div>{hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}</div>;
}

function ServiceImagePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return previewUrl ? <img src={previewUrl} alt="Selected service preview" className="mt-3 max-h-48 w-full rounded-lg object-cover" /> : null;
}
