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
import { bookingsApi, servicesApi, usersApi, type ApiUser, type Service, type Subscription, type PropertyType, type Booking } from "@/lib/api";

export const Route = createFileRoute("/_dash/subscriptions")({ component: SubscriptionsPage });

import { LocationPicker } from "@/components/location-picker";

const steps = ["Customer", "Service", "Schedule", "Review"];
const blank = { scheduled_for: "", property_type_id: "", address_line: "", city: "", latitude: "", longitude: "", recurrence_end_date: "", session_days: "" };

function SubscriptionsPage() {
  const [visits, setVisits] = useState<Booking[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [details, setDetails] = useState<Subscription | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [propertyDetails, setPropertyDetails] = useState<Record<string, unknown>>({});
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

  useEffect(() => {
    let cancelled = false;
    setVisits([]); setVisitsError(null);
    if (!details) return;
    setVisitsLoading(true);
    void (async () => {
      try {
        const collected: Booking[] = [];
        for (let offset = 0; ; offset += 200) {
          const page = await bookingsApi.list({customer_id: details.customer_id, limit: 200, offset});
          if (cancelled) return;
          collected.push(...page.filter((visit) => visit.recurring_plan?.id === details.id));
          if (page.length < 200) break;
        }
        if (!cancelled) setVisits(collected.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
      } catch (error) { if (!cancelled) setVisitsError(error instanceof Error ? error.message : "Unable to load visits."); }
      finally { if (!cancelled) setVisitsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [details]);

  const load = async () => {
    try {
      setError(null);
      const [plans, catalog, sizes] = await Promise.all([servicesApi.subscriptions(), servicesApi.list(), bookingsApi.propertyTypes()]);
      setSubscriptions(plans);
      setServices(catalog);
      setPropertyTypes(sizes.filter((item) => item.is_active));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load subscriptions."); }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (customerQuery.trim().length < 2) { setCustomers([]); return; }
    const timer = window.setTimeout(() => { void usersApi.list("customer", customerQuery).then(setCustomers).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to search customers.")); }, 300);
    return () => window.clearTimeout(timer);
  }, [customerQuery]);

  const resetWizard = () => { setStep(0); setCustomer(null); setCustomerQuery(""); setCustomers([]); setServiceId(""); setPackageId(""); setAddons({}); setForm(blank); setPropertyDetails({}); setQuote(null); setError(null); };
  const selectedProperty = propertyTypes.find((item) => item.id === form.property_type_id);
  const propertyError = () => {
    if (!selectedProperty) return "Select a property type.";
    for (const field of selectedProperty.fields) {
      const value = propertyDetails[field.key];
      if (field.required && (value === undefined || value === "" || value === null)) return `Complete ${field.label}.`;
      if (field.type === "number" && value !== undefined && value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) return `${field.label} must be a nonnegative number.`;
    }
    return null;
  };
  const sessionDays = () => form.session_days.split(",").map((value) => Number(value.trim()));
  const scheduleError = () => {
    const propertyIssue = propertyError();
    if (propertyIssue) return propertyIssue;
    const first = new Date(form.scheduled_for);
    if (!form.scheduled_for || !Number.isFinite(first.getTime()) || first.getTime() <= Date.now()) return "Select a future first visit date and time.";
    if (form.address_line.trim().length < 3 || form.latitude === "" || form.longitude === "") return "Select an address on Google Maps before continuing.";
    if (!Number.isFinite(Number(form.latitude)) || !Number.isFinite(Number(form.longitude))) return "Select a valid location on the map.";
    if (selectedPackage?.billing_cycle === "monthly") {
      const days = sessionDays();
      if (!form.session_days.trim() || days.some((day) => !Number.isInteger(day) || day < 1 || day > 28) || new Set(days).size !== days.length) return "Enter unique monthly days between 1 and 28.";
      if (days.length !== (selectedPackage.visits_per_cycle ?? 1)) return `Select exactly ${selectedPackage.visits_per_cycle ?? 1} monthly visit days.`;
      if (first.getUTCDate() !== Math.min(...days)) return "The first visit must fall on the earliest selected monthly day (using the submitted UTC time).";
    }
    if (form.recurrence_end_date && form.recurrence_end_date < first.toISOString().slice(0, 10)) return "The end date cannot precede the first visit.";
    return null;
  };
  useEffect(() => { setQuote(null); }, [serviceId, packageId, addons, form.property_type_id, propertyDetails]);
  const next = () => {
    if (step === 0 && !customer) return setError("Select a customer to continue.");
    if (step === 1 && (!selectedService || !selectedPackage)) return setError("Select a service and recurring package to continue.");
    if (step === 2) { const issue = scheduleError(); if (issue) return setError(issue); }
    setError(null); setStep((current) => Math.min(3, current + 1));
  };
  const selectedAddons = () => Object.entries(addons).filter(([, quantity]) => quantity > 0).map(([additional_service_id, quantity]) => ({ additional_service_id, quantity }));
  const buildPayload = () => ({ service_type_id: serviceId, service_package_id: packageId, property_type_id: form.property_type_id, property_details: Object.fromEntries(Object.entries(propertyDetails).filter(([, value]) => value !== "" && value !== undefined)), ...(selectedAddons().length ? { additional_services: selectedAddons() } : {}) });
  const getQuote = async () => { const issue = propertyError(); if (issue) return setError(issue); try { setError(null); setQuote(await bookingsApi.quote(buildPayload())); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to calculate quote."); } };
  const create = async () => {
    if (!customer) return;
    const issue = scheduleError(); if (issue) return setError(issue);
    setLoading(true);
    try {
      await bookingsApi.create({ customer_id: customer.id, ...buildPayload(), scheduled_for: new Date(form.scheduled_for).toISOString(), address_line: form.address_line, city: form.city || undefined, latitude: Number(form.latitude), longitude: Number(form.longitude), ...(form.recurrence_end_date ? { recurrence_end_date: form.recurrence_end_date } : {}), ...(selectedPackage?.billing_cycle === "monthly" ? { session_days_of_month: sessionDays() } : {}) });
      setOpen(false); resetWizard(); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create subscription."); }
    finally { setLoading(false); }
  };
  const cancel = async (item: Subscription) => { if (!window.confirm("Cancel this subscription? Existing booking history will be kept.")) return; try { await servicesApi.updateSubscription(item.id, { status: "cancelled" }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to cancel subscription."); } };

  return <div className="space-y-6">
    <PageHeader title="Subscriptions" description="Create recurring service plans and manage active subscriptions." actions={<><Button onClick={() => { resetWizard(); setOpen(true); }}>Create subscription</Button><Button variant="outline" onClick={() => void load()}>Refresh</Button></>} />
    {error && <p className="text-sm text-destructive">{error}</p>}
    <Card className="p-4"><Table><TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Subscription</TableHead><TableHead>Customer</TableHead><TableHead>Billing cycle</TableHead><TableHead>Next service</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price per cycle</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{subscriptions.map((item, index) => <TableRow key={item.id}><TableCell className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</TableCell><TableCell><button type="button" onClick={() => setDetails(item)} className="text-left font-semibold text-blue-900 hover:underline">{item.subscription_name || "Cleaning subscription"}</button><p className="mt-1 text-xs text-muted-foreground">{item.visits_per_cycle ?? "—"} visits per cycle</p></TableCell><TableCell>{item.customer_name || "Customer unavailable"}</TableCell><TableCell>{item.billing_cycle.replaceAll("_", " ")}</TableCell><TableCell>{item.next_service_date || "—"}</TableCell><TableCell><Badge variant={item.status === "active" ? "success" : "secondary"}>{item.status}</Badge></TableCell><TableCell className="text-right">{item.currency} {Number(item.price_per_cycle).toLocaleString()}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" className="mr-2" onClick={() => setDetails(item)}>View details</Button><Button size="sm" variant="destructive" disabled={item.status === "cancelled"} onClick={() => void cancel(item)}>Cancel</Button></TableCell></TableRow>)}{!subscriptions.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No subscriptions found.</TableCell></TableRow>}</TableBody></Table></Card>

    <Dialog open={details !== null} onOpenChange={(value) => { if (!value) setDetails(null); }}><DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{details?.subscription_name || "Subscription details"}</DialogTitle></DialogHeader>{details && <div className="space-y-5"><div className="flex items-center justify-between"><p className="text-lg font-medium">{details.customer_name || "Customer unavailable"}</p><Badge variant={details.status === "active" ? "success" : "secondary"}>{details.status}</Badge></div><dl className="grid grid-cols-2 gap-4 text-sm">{[
      ["Billing cycle", details.billing_cycle.replaceAll("_", " ")],
      ["Price per cycle", `${details.currency} ${Number(details.price_per_cycle).toLocaleString()}`],
      ["Visits per cycle", details.visits_per_cycle], ["Commitment cycles", details.commitment_cycles],
      ["Start date", details.starts_on], ["End date", details.ends_on || "No end date"],
      ["Next scheduled date", ["cancelled", "completed"].includes(details.status) ? "No upcoming visits" : details.next_service_date || "Not scheduled"],
      ["Monthly visit days", details.session_days_of_month?.join(", ") || "Not applicable"],
    ].map(([label, value]) => <div key={String(label)}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value ?? "—"}</dd></div>)}</dl><section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Cleaning visits</h3>{visitsLoading ? <p>Loading visits…</p> : visitsError ? <p role="alert" className="text-destructive">{visitsError}</p> : visits.length === 0 ? <p>No visits found.</p> : visits.map((visit) => <div key={visit.id} className="rounded-md border p-3 text-sm"><div className="flex justify-between gap-3"><p className="font-medium">{new Date(visit.scheduled_for).toLocaleString()}</p><Badge variant="secondary">{visit.status.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-muted-foreground">Month / cycle {visit.cycle_number ?? 1} · {visit.cleaner?.full_name || "Cleaner not assigned"}</p><p className="mt-2">Visit total: {visit.currency} {Number(visit.quoted_price).toLocaleString()}</p>{visit.additional_services?.map((addon, index) => <p key={index} className="mt-1 text-muted-foreground">{String(addon.name_snapshot ?? addon.name ?? "Add-on")} × {addon.quantity ?? 1}: {String(addon.currency ?? visit.currency)} {Number(addon.total_price ?? addon.amount ?? 0).toLocaleString()} (included)</p>)}</div>)}</section><div className="border-t pt-3 text-xs text-muted-foreground"><p>Subscription reference</p><p className="mt-1 break-all font-mono">{details.id}</p><p className="mt-3">Customer reference</p><p className="mt-1 break-all font-mono">{details.customer_id}</p></div></div>}</DialogContent></Dialog>

    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetWizard(); }}><DialogContent onInteractOutside={(event) => { if (event.target instanceof Element && event.target.closest(".pac-container")) event.preventDefault(); }} className="max-h-[88vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Create subscription</DialogTitle></DialogHeader><div className="grid grid-cols-4 gap-2">{steps.map((name, index) => <div key={name} className={`rounded px-2 py-2 text-center text-xs font-medium ${index === step ? "bg-blue-950 text-white" : index < step ? "bg-blue-100 text-blue-950" : "bg-muted text-muted-foreground"}`}>{index + 1}. {name}</div>)}</div>
      {step === 0 && <div className="space-y-3"><Field label="Find customer"><Input autoFocus placeholder="Search by name, email or phone" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} /></Field><div className="space-y-2">{customers.map((item) => <button type="button" key={item.id} onClick={() => { setCustomer(item); setCustomerQuery(item.full_name); setCustomers([]); }} className={`w-full rounded-md border p-3 text-left ${customer?.id === item.id ? "border-blue-700 bg-blue-50" : "hover:bg-muted"}`}><p className="font-medium">{item.full_name}</p><p className="text-sm text-muted-foreground">{item.email || "No email"} · {item.phone || "No phone"}</p></button>)}</div>{customer && <Card className="border-blue-200 bg-blue-50 p-3 text-sm"><b>Selected:</b> {customer.full_name} · {customer.email || customer.phone}</Card>}</div>}
      {step === 1 && <div className="space-y-4"><Field label="Service"><select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setPackageId(""); setAddons({}); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select a service</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{selectedService && <><Field label="Recurring package"><div className="grid gap-2 sm:grid-cols-2">{selectedService.packages.filter((item) => item.is_active && !["one_time", "hourly"].includes(item.billing_cycle)).map((item) => <button type="button" key={item.id} onClick={() => setPackageId(item.id)} className={`rounded-md border p-3 text-left ${packageId === item.id ? "border-blue-700 bg-blue-50" : "hover:bg-muted"}`}><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.currency} {Number(item.price).toLocaleString()} · {item.billing_cycle}</p><p className="text-xs text-muted-foreground">{item.visits_per_cycle ?? 1} visit(s) per cycle · {item.billing_cycle === "monthly" ? "1 month by default" : `${item.commitment_cycles ?? "—"} cycles`}</p></button>)}</div></Field><div><Label>Add-ons (optional)</Label><div className="mt-2 space-y-2">{selectedService.additional_services.filter((item) => item.is_active).map((item) => <div key={item.id} className="flex items-center justify-between rounded border p-3"><div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.currency} {Number(item.rate).toLocaleString()} {item.applies_per_session ? "per session" : "once"}</p></div><div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setAddons({ ...addons, [item.id]: Math.max(0, (addons[item.id] ?? 0) - 1) })}>−</Button><span className="w-5 text-center">{addons[item.id] ?? 0}</span><Button type="button" size="sm" variant="outline" disabled={(addons[item.id] ?? 0) >= (item.maximum_quantity ?? 100)} onClick={() => setAddons({ ...addons, [item.id]: (addons[item.id] ?? 0) + 1 })}>+</Button></div></div>)}</div></div></>}</div>}
      {step === 2 && <div className="grid gap-4 sm:grid-cols-2"><Field label="First service date and time"><Input type="datetime-local" value={form.scheduled_for} onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })} /></Field><Field label="Property type"><select value={form.property_type_id} onChange={(event) => { const id = event.target.value; setForm({ ...form, property_type_id: id }); setPropertyDetails(Object.fromEntries((propertyTypes.find((item) => item.id === id)?.fields ?? []).filter((field) => field.type === "boolean").map((field) => [field.key, false]))); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select property type</option>{propertyTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        {selectedProperty?.fields.map((field) => <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}`}>
          {field.type === "select" ? <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={String(propertyDetails[field.key] ?? "")} onChange={(event) => setPropertyDetails({ ...propertyDetails, [field.key]: event.target.value })}><option value="">Select {field.label}</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === "boolean" ? <input type="checkbox" checked={Boolean(propertyDetails[field.key])} onChange={(event) => setPropertyDetails({ ...propertyDetails, [field.key]: event.target.checked })} /> : <Input type={field.type === "number" ? "number" : "text"} min={field.type === "number" ? 0 : undefined} step="any" value={String(propertyDetails[field.key] ?? "")} onChange={(event) => setPropertyDetails({ ...propertyDetails, [field.key]: field.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value })} />}
        </Field>)}
        {!propertyTypes.length && <p className="text-sm text-destructive">No active property types are available. Add one before creating a subscription.</p>}
        {selectedPackage?.billing_cycle === "monthly" && <Field label="Monthly visit days"><Input placeholder="e.g. 1, 15" value={form.session_days} onChange={(event) => setForm({ ...form, session_days: event.target.value })} /></Field>}<Field label="End date (optional — defaults to one month)"><Input type="date" value={form.recurrence_end_date} onChange={(event) => setForm({ ...form, recurrence_end_date: event.target.value })} /></Field><div className="sm:col-span-2"><LocationPicker mapSelectionOnly latitude={form.latitude} longitude={form.longitude} city={form.city} address={form.address_line} label="Cleaning address" onChange={(location) => setForm((current) => ({ ...current, address_line: location.address, city: location.city, latitude: location.latitude == null ? "" : String(location.latitude), longitude: location.longitude == null ? "" : String(location.longitude) }))} /><p className="mt-2 text-xs text-muted-foreground">Choose a search result, click the map, or drag its pin. The address and coordinates are filled from Google Maps.</p></div><div className="sm:col-span-2"><Button type="button" variant="outline" disabled={!form.property_type_id} onClick={() => void getQuote()}>Calculate exact price</Button></div></div>}
      {step === 3 && <div className="space-y-3"><Card className="p-4 text-sm"><p><b>Customer:</b> {customer?.full_name}</p><p><b>Service:</b> {selectedService?.name} · {selectedPackage?.name}</p><p><b>First visit:</b> {form.scheduled_for || "—"}</p><p><b>Address:</b> {form.address_line}{form.city ? `, ${form.city}` : ""}</p><p><b>Add-ons:</b> {selectedAddons().length || "None"}</p></Card>{quote ? <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm"><p className="font-semibold">Quote ready</p><p>Package: {String(quote.currency ?? "")} {Number(quote.package_total ?? 0).toLocaleString()}</p><p>Add-ons: {String(quote.currency ?? "")} {Number(quote.additional_services_total ?? 0).toLocaleString()}</p>{Array.isArray(quote.additional_service_items) && (quote.additional_service_items as Array<Record<string, unknown>>).map((addon, index) => <p key={index}>{String(addon.name ?? "Add-on")} × {String(addon.quantity ?? 1)}: {String(addon.currency ?? quote.currency ?? "")} {Number(addon.total_price ?? 0).toLocaleString()}</p>)}<p>Total per cycle: <b>{String(quote.total_price ?? quote.package_total ?? "—")} {String(quote.currency ?? "")}</b></p><p className="text-muted-foreground">{String(quote.calculation ?? quote.description ?? "Review the calculated price before confirming.")}</p></Card> : <p className="text-sm text-muted-foreground">You can return to Schedule and select “Calculate exact price” before creating.</p>}</div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-between pt-3"><Button type="button" variant="outline" disabled={step === 0 || loading} onClick={() => setStep((current) => current - 1)}>Back</Button>{step < 3 ? <Button type="button" onClick={next}>Continue</Button> : <Button type="button" disabled={loading} onClick={() => void create()}>{loading ? "Creating…" : "Create subscription"}</Button>}</div>
    </DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>; }
