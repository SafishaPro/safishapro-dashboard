import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { servicesApi, type Service, type ServiceAddon, type ServicePackage, type Subscription } from "@/lib/api";

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
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionStartDate, setSubscriptionStartDate] = useState("");
  const [subscriptionEndDate, setSubscriptionEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingAddon, setCreatingAddon] = useState(false);
  const [creatingPackage, setCreatingPackage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyService);
  const [addonForm, setAddonForm] = useState(emptyAddon);
  const [addon, setAddon] = useState<ServiceAddon | null>(null);
  const [packageItem, setPackageItem] = useState<ServicePackage | null>(null);
  const [packageForm, setPackageForm] = useState(emptyPackage);

  const load = async () => {
    if (subscriptionStartDate && subscriptionEndDate && subscriptionStartDate > subscriptionEndDate) {
      setError("Start date cannot be after end date.");
      return;
    }
    try {
      setError(null);
      const [catalog, plans] = await Promise.all([servicesApi.list(true), servicesApi.subscriptions({ start_date: subscriptionStartDate || undefined, end_date: subscriptionEndDate || undefined })]);
      setServices(catalog);
      setSubscriptions(plans);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load services.");
    }
  };

  useEffect(() => { void load(); }, []);

  const beginCreate = () => {
    setForm(emptyService);
    setCreating(true);
  };

  const saveService = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (service) {
        const next = await servicesApi.update(service.id, {
          name: form.name,
          description: form.description || null,
          base_price: Number(form.base_price),
          estimated_duration_minutes: Number(form.estimated_duration_minutes),
        });
        setService(next);
      } else {
        const created = await servicesApi.create({
          name: form.name,
          base_price: Number(form.base_price),
          estimated_duration_minutes: Number(form.estimated_duration_minutes),
          description: form.description || undefined,
        });
        setService(created);
      }
      setCreating(false);
      setEditing(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save service.");
    }
  };

  const editService = (item: Service) => {
    setService(item);
    setForm({
      name: item.name,
      slug: item.slug,
      base_price: String(item.base_price),
      estimated_duration_minutes: String(item.estimated_duration_minutes),
      description: item.description || "",
    });
    setEditing(true);
  };

  const cancelSubscription = async (item: Subscription) => {
    try {
      await servicesApi.updateSubscription(item.id, { status: "cancelled" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to cancel subscription.");
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
        title="Services & subscriptions"
        description="Manage service catalogues, packages, add-ons, and recurring plans."
        actions={
          <>
            <Button onClick={beginCreate}>Create service</Button>
            <Button variant="outline" onClick={() => void load()}>Refresh</Button>
          </>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Service catalog</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="mt-4">
          <Card className="p-4">
            <Table>
              <TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Service</TableHead><TableHead>Base price</TableHead><TableHead>Duration</TableHead><TableHead>Packages</TableHead><TableHead>Add-ons</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {services.map((item, index) => <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</TableCell>
                  <TableCell><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.description || item.slug}</p></TableCell>
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
                {!services.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No services found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="subscriptions" className="mt-4">
          <Card className="p-4">
            <div className="mb-4 flex flex-wrap gap-3">
              <Input aria-label="Subscription start date" className="w-40" type="date" value={subscriptionStartDate} max={subscriptionEndDate || undefined} onChange={(event) => setSubscriptionStartDate(event.target.value)} />
              <Input aria-label="Subscription end date" className="w-40" type="date" value={subscriptionEndDate} min={subscriptionStartDate || undefined} onChange={(event) => setSubscriptionEndDate(event.target.value)} />
              <Button onClick={() => void load()}>Apply filters</Button>
              <Button variant="ghost" onClick={() => { setSubscriptionStartDate(""); setSubscriptionEndDate(""); }}>Reset</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Subscription</TableHead><TableHead>Billing cycle</TableHead><TableHead>Next service</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price per cycle</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {subscriptions.map((item, index) => <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</TableCell>
                  <TableCell className="font-mono text-xs">{item.id}</TableCell>
                  <TableCell>{item.billing_cycle.replaceAll("_", " ")}</TableCell>
                  <TableCell>{item.next_service_date || "—"}</TableCell>
                  <TableCell><Badge variant={item.status === "active" ? "success" : "secondary"}>{item.status}</Badge></TableCell>
                  <TableCell className="text-right">{item.currency} {Number(item.price_per_cycle).toLocaleString()}</TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-2">
                    <Button size="sm" className="bg-blue-950 text-white hover:bg-blue-900" onClick={() => setSubscription(item)}>View details</Button>
                    <Button size="sm" variant="destructive" disabled={item.status === "cancelled"} onClick={() => void cancelSubscription(item)}>Cancel</Button>
                  </div></TableCell>
                </TableRow>)}
                {!subscriptions.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No subscriptions found.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={creating || Boolean(service)} onOpenChange={(open) => {
        if (!open) { setCreating(false); setService(null); setEditing(false); }
      }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{creating ? "Create service" : editing ? "Edit service" : "Service details"}</DialogTitle></DialogHeader>
          {(creating || editing) ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveService}>
            <Field label="Service name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label="Base price"><Input type="number" min="0" value={form.base_price} onChange={(event) => setForm({ ...form, base_price: event.target.value })} required /></Field>
            <Field label="Duration (minutes)"><Input type="number" min="1" value={form.estimated_duration_minutes} onChange={(event) => setForm({ ...form, estimated_duration_minutes: event.target.value })} required /></Field>
            <div className="sm:col-span-2"><Field label="Description"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
            <div className="sm:col-span-2 flex gap-2"><Button>{creating ? "Create service" : "Save changes"}</Button><Button type="button" variant="outline" onClick={() => { setCreating(false); setEditing(false); }}>Cancel</Button></div>
          </form> : service && <ServiceDetails service={service} onCreateAddon={() => { setAddon(null); setAddonForm(emptyAddon); setCreatingAddon(true); }} onEditAddon={(item) => { setAddon(item); setAddonForm({ name: item.name, description: item.description || "", rate: String(item.rate), currency: item.currency, applies_per_session: item.applies_per_session, maximum_quantity: item.maximum_quantity ? String(item.maximum_quantity) : "" }); }} onCreatePackage={() => { setPackageItem(null); setPackageForm(emptyPackage); setCreatingPackage(true); }} onEditPackage={(item) => { setPackageItem(item); setPackageForm({ name: item.name, description: item.description || "", price: String(item.price), currency: item.currency, pricing_model: item.pricing_model, billing_cycle: item.billing_cycle, visits_per_cycle: item.visits_per_cycle ? String(item.visits_per_cycle) : "", commitment_cycles: item.commitment_cycles ? String(item.commitment_cycles) : "", included_items: item.included_items?.join(", ") || "" }); }} />}
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

      <Dialog open={Boolean(subscription)} onOpenChange={(open) => !open && setSubscription(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Subscription details</DialogTitle></DialogHeader>
          {subscription && <div className="grid grid-cols-2 gap-3 text-sm">
            {[["Status", subscription.status], ["Billing cycle", subscription.billing_cycle], ["Price", `${subscription.currency} ${Number(subscription.price_per_cycle).toLocaleString()}`], ["Next service", subscription.next_service_date], ["Starts", subscription.starts_on], ["Ends", subscription.ends_on]].map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>)}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceDetails({ service, onCreateAddon, onEditAddon, onCreatePackage, onEditPackage }: { service: Service; onCreateAddon: () => void; onEditAddon: (item: ServiceAddon) => void; onCreatePackage: () => void; onEditPackage: (item: ServicePackage) => void }) {
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 text-sm">
      {[["Name", service.name], ["Slug", service.slug], ["Base price", `KES ${Number(service.base_price).toLocaleString()}`], ["Duration", `${service.estimated_duration_minutes} minutes`]].map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>)}
    </div>
    <p className="text-sm">{service.description || "No description"}</p>
    <div><div className="mb-2 flex items-center justify-between"><h3 className="font-medium">Packages</h3><Button size="sm" onClick={onCreatePackage}>Create package</Button></div><div className="grid gap-3 sm:grid-cols-2">{service.packages.map((item) => <div key={item.id} className={`rounded-lg border p-3 text-sm ${packageColour(item.pricing_model)}`}><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-lg font-bold">{item.currency} {Number(item.price).toLocaleString()}</p></div><Badge variant={item.is_active ? "success" : "secondary"}>{item.is_active ? "Active" : "Inactive"}</Badge></div><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{readable(item.pricing_model)} · {readable(item.billing_cycle)}</span><Button size="sm" variant="outline" onClick={() => onEditPackage(item)}>Edit</Button></div></div>)}{!service.packages.length && <p className="text-sm text-muted-foreground">No packages configured.</p>}</div></div>
    <div><div className="mb-2 flex items-center justify-between"><h3 className="font-medium">Add-ons</h3><Button size="sm" onClick={onCreateAddon}>Create add-on</Button></div><div className="space-y-2">{service.additional_services.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded border p-3 text-sm"><div><p className="font-medium">{item.name} <span className="font-normal text-muted-foreground">· {item.currency} {Number(item.rate).toLocaleString()} {item.applies_per_session ? "per session" : "once"}</span></p>{item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}</div><Button size="sm" variant="outline" onClick={() => onEditAddon(item)}>Edit</Button></div>)}{!service.additional_services.length && <p className="text-sm text-muted-foreground">No add-ons configured.</p>}</div></div>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><Label>{label}</Label><div className="mt-1">{children}</div></div>;
}
