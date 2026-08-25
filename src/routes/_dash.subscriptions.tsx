import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bookingsApi, servicesApi, usersApi, type ApiUser, type Service, type Subscription } from "@/lib/api";

export const Route = createFileRoute("/_dash/subscriptions")({ component: SubscriptionsPage });

const steps = ["Customer", "Service", "Schedule", "Review"];
const blank = { scheduled_for: "", property_size: "", rooms: "", address_line: "", city: "", latitude: "", longitude: "", recurrence_end_date: "", session_days: "" };

function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [propertySizes, setPropertySizes] = useState<Array<{ value: string; label: string }>>([]);
  const [customers, setCustomers] = useState<ApiUser[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customer, setCustomer] = useState<ApiUser | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [addons, setAddons] = useState<Record<string, number>>({});
  const [form, setForm] = useState(blank);
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedService = useMemo(() => services.find((service) => service.id === serviceId) ?? null, [services, serviceId]);
  const selectedPackage = useMemo(() => selectedService?.packages.find((item) => item.id === packageId) ?? null, [selectedService, packageId]);

  const load = async () => {
    try {
      setError(null);
      const [plans, catalog, sizes] = await Promise.all([servicesApi.subscriptions(), servicesApi.list(), bookingsApi.propertySizes()]);
      setSubscriptions(plans);
      setServices(catalog);
      setPropertySizes(sizes);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load subscriptions."); }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (customerQuery.trim().length < 2) { setCustomers([]); return; }
    const timer = window.setTimeout(() => { void usersApi.list("customer", customerQuery).then(setCustomers).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to search customers.")); }, 300);
    return () => window.clearTimeout(timer);
  }, [customerQuery]);

  const resetWizard = () => { setStep(0); setCustomer(null); setCustomerQuery(""); setCustomers([]); setServiceId(""); setPackageId(""); setAddons({}); setForm(blank); setQuote(null); setError(null); };
  const next = () => {
    if (step === 0 && !customer) return setError("Select a customer to continue.");
    if (step === 1 && (!selectedService || !selectedPackage)) return setError("Select a service and recurring package to continue.");
    if (step === 2 && (!form.scheduled_for || !form.property_size || !form.address_line || !form.latitude || !form.longitude)) return setError("Complete the date, property and address details.");
    setError(null); setStep((current) => Math.min(3, current + 1));
  };
  const selectedAddons = () => Object.entries(addons).filter(([, quantity]) => quantity > 0).map(([additional_service_id, quantity]) => ({ additional_service_id, quantity }));
  const buildPayload = () => ({ service_type_id: serviceId, service_package_id: packageId, property_size: form.property_size, ...(form.rooms ? { rooms: Number(form.rooms) } : {}), ...(selectedAddons().length ? { additional_services: selectedAddons() } : {}) });
  const getQuote = async () => { try { setError(null); setQuote(await bookingsApi.quote(buildPayload())); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to calculate quote."); } };
  const create = async () => {
    if (!customer) return;
    setLoading(true);
    try {
      await bookingsApi.create({ customer_id: customer.id, ...buildPayload(), scheduled_for: new Date(form.scheduled_for).toISOString(), address_line: form.address_line, city: form.city || undefined, latitude: Number(form.latitude), longitude: Number(form.longitude), ...(form.recurrence_end_date ? { recurrence_end_date: form.recurrence_end_date } : {}), ...(form.session_days ? { session_days_of_month: form.session_days.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 1 && value <= 28) } : {}) });
      setOpen(false); resetWizard(); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create subscription."); }
    finally { setLoading(false); }
  };
  const cancel = async (item: Subscription) => { if (!window.confirm("Cancel this subscription? Existing booking history will be kept.")) return; try { await servicesApi.updateSubscription(item.id, { status: "cancelled" }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to cancel subscription."); } };

  return <div className="space-y-6">
    <PageHeader title="Subscriptions" description="Create recurring service plans and manage active subscriptions." actions={<><Button onClick={() => { resetWizard(); setOpen(true); }}>Create subscription</Button><Button variant="outline" onClick={() => void load()}>Refresh</Button></>} />
    {error && <p className="text-sm text-destructive">{error}</p>}
    <Card className="p-4"><Table><TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Subscription</TableHead><TableHead>Billing cycle</TableHead><TableHead>Next service</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price per cycle</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{subscriptions.map((item, index) => <TableRow key={item.id}><TableCell className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</TableCell><TableCell><p className="font-mono text-xs">{item.id}</p><p className="mt-1 text-xs text-muted-foreground">Customer: {item.customer_id}</p></TableCell><TableCell>{item.billing_cycle.replaceAll("_", " ")}</TableCell><TableCell>{item.next_service_date || "—"}</TableCell><TableCell><Badge variant={item.status === "active" ? "success" : "secondary"}>{item.status}</Badge></TableCell><TableCell className="text-right">{item.currency} {Number(item.price_per_cycle).toLocaleString()}</TableCell><TableCell className="text-right"><Button size="sm" variant="destructive" disabled={item.status === "cancelled"} onClick={() => void cancel(item)}>Cancel</Button></TableCell></TableRow>)}{!subscriptions.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No subscriptions found.</TableCell></TableRow>}</TableBody></Table></Card>

    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetWizard(); }}><DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Create subscription</DialogTitle></DialogHeader><div className="grid grid-cols-4 gap-2">{steps.map((name, index) => <div key={name} className={`rounded px-2 py-2 text-center text-xs font-medium ${index === step ? "bg-blue-950 text-white" : index < step ? "bg-blue-100 text-blue-950" : "bg-muted text-muted-foreground"}`}>{index + 1}. {name}</div>)}</div>
      {step === 0 && <div className="space-y-3"><Field label="Find customer"><Input autoFocus placeholder="Search by name, email or phone" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} /></Field><div className="space-y-2">{customers.map((item) => <button type="button" key={item.id} onClick={() => { setCustomer(item); setCustomerQuery(item.full_name); setCustomers([]); }} className={`w-full rounded-md border p-3 text-left ${customer?.id === item.id ? "border-blue-700 bg-blue-50" : "hover:bg-muted"}`}><p className="font-medium">{item.full_name}</p><p className="text-sm text-muted-foreground">{item.email || "No email"} · {item.phone || "No phone"}</p></button>)}</div>{customer && <Card className="border-blue-200 bg-blue-50 p-3 text-sm"><b>Selected:</b> {customer.full_name} · {customer.email || customer.phone}</Card>}</div>}
      {step === 1 && <div className="space-y-4"><Field label="Service"><select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setPackageId(""); setAddons({}); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select a service</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{selectedService && <><Field label="Recurring package"><div className="grid gap-2 sm:grid-cols-2">{selectedService.packages.filter((item) => item.is_active && !["one_time", "hourly"].includes(item.billing_cycle)).map((item) => <button type="button" key={item.id} onClick={() => setPackageId(item.id)} className={`rounded-md border p-3 text-left ${packageId === item.id ? "border-blue-700 bg-blue-50" : "hover:bg-muted"}`}><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.currency} {Number(item.price).toLocaleString()} · {item.billing_cycle}</p><p className="text-xs text-muted-foreground">{item.visits_per_cycle ?? 1} visit(s) per cycle · {item.commitment_cycles ?? "—"} cycles</p></button>)}</div></Field><div><Label>Add-ons (optional)</Label><div className="mt-2 space-y-2">{selectedService.additional_services.filter((item) => item.is_active).map((item) => <div key={item.id} className="flex items-center justify-between rounded border p-3"><div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.currency} {Number(item.rate).toLocaleString()} {item.applies_per_session ? "per session" : "once"}</p></div><div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setAddons({ ...addons, [item.id]: Math.max(0, (addons[item.id] ?? 0) - 1) })}>−</Button><span className="w-5 text-center">{addons[item.id] ?? 0}</span><Button type="button" size="sm" variant="outline" disabled={(addons[item.id] ?? 0) >= (item.maximum_quantity ?? 100)} onClick={() => setAddons({ ...addons, [item.id]: (addons[item.id] ?? 0) + 1 })}>+</Button></div></div>)}</div></div></>}</div>}
      {step === 2 && <div className="grid gap-4 sm:grid-cols-2"><Field label="First service date and time"><Input type="datetime-local" value={form.scheduled_for} onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })} /></Field><Field label="Property size"><select value={form.property_size} onChange={(event) => { setForm({ ...form, property_size: event.target.value }); setQuote(null); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required><option value="">Select property size</option>{propertySizes.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}</select></Field><Field label="Rooms (optional)"><Input type="number" min="0" value={form.rooms} onChange={(event) => setForm({ ...form, rooms: event.target.value })} /></Field><Field label="Monthly visit days"><Input placeholder="e.g. 1, 15" value={form.session_days} onChange={(event) => setForm({ ...form, session_days: event.target.value })} /></Field><Field label="Recurrence end date (optional)"><Input type="date" value={form.recurrence_end_date} onChange={(event) => setForm({ ...form, recurrence_end_date: event.target.value })} /></Field><Field label="City"><Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="Address"><Input value={form.address_line} onChange={(event) => setForm({ ...form, address_line: event.target.value })} /></Field></div><Field label="Latitude"><Input type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></Field><Field label="Longitude"><Input type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></Field><div className="sm:col-span-2"><Button type="button" variant="outline" disabled={!form.property_size} onClick={() => void getQuote()}>Calculate exact price</Button></div></div>}
      {step === 3 && <div className="space-y-3"><Card className="p-4 text-sm"><p><b>Customer:</b> {customer?.full_name}</p><p><b>Service:</b> {selectedService?.name} · {selectedPackage?.name}</p><p><b>First visit:</b> {form.scheduled_for || "—"}</p><p><b>Address:</b> {form.address_line}{form.city ? `, ${form.city}` : ""}</p><p><b>Add-ons:</b> {selectedAddons().length || "None"}</p></Card>{quote ? <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm"><p className="font-semibold">Quote ready</p><p>Total: <b>{String(quote.total_price ?? quote.package_total ?? "—")} {String(quote.currency ?? "")}</b></p><p className="text-muted-foreground">{String(quote.calculation ?? quote.description ?? "Review the calculated price before confirming.")}</p></Card> : <p className="text-sm text-muted-foreground">You can return to Schedule and select “Calculate exact price” before creating.</p>}</div>}
      <div className="flex justify-between pt-3"><Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>Back</Button>{step < 3 ? <Button type="button" onClick={next}>Continue</Button> : <Button type="button" disabled={loading} onClick={() => void create()}>{loading ? "Creating…" : "Create subscription"}</Button>}</div>
    </DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>; }
