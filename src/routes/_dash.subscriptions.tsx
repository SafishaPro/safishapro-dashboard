import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bookingsApi, paymentsApi, servicesApi, usersApi, type ApiUser, type Service, type Subscription, type SubscriptionDetails, type SubscriptionPage, type Payment, type PropertyType, type Booking } from "@/lib/api";
import { CalendarDays, CheckCircle2, CreditCard, Layers3, Loader2, PauseCircle, Search, Smartphone } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_dash/subscriptions")({ component: SubscriptionsPage });

import { LocationPicker } from "@/components/location-picker";

const steps = ["Customer", "Service", "Schedule", "Review"];
const blank = { scheduled_for: "", property_type_id: "", address_line: "", city: "", latitude: "", longitude: "", recurrence_end_date: "", session_days: "" };
const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const readableCycle = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatMoney = (value: unknown, currency: string) => `${currency} ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
const ordinal = (value: number) => { const remainder = value % 100; const suffix = remainder >= 11 && remainder <= 13 ? "th" : value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"; return `${value}${suffix}`; };
const statusStyles: Record<Subscription["status"], string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paused: "border-amber-200 bg-amber-50 text-amber-800",
  cancelled: "border-slate-200 bg-slate-100 text-slate-600",
  completed: "border-blue-200 bg-blue-50 text-blue-700",
};

function SubscriptionsPage() {
  const { can } = useAuth();
  const canReadServices = can("services.read");
  const canReadPayments = can("payments.read");
  const canUpdatePayments = can("payments.update");
  const [visits, setVisits] = useState<Booking[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [details, setDetails] = useState<Subscription | null>(null);
  const [subscriptionTab, setSubscriptionTab] = useState("overview");
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentAction, setPaymentAction] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentPhones, setPaymentPhones] = useState<Record<string, string>>({});
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const listRequestSequence = useRef(0);
  const [services, setServices] = useState<Service[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [propertyDetails, setPropertyDetails] = useState<Record<string, unknown>>({});
  const [customers, setCustomers] = useState<ApiUser[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customer, setCustomer] = useState<ApiUser | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [packagesLoading, setPackagesLoading] = useState(false);
  const packageRequestSequence = useRef(0);
  const [packageId, setPackageId] = useState("");
  const [addons, setAddons] = useState<Record<string, number>>({});
  const [form, setForm] = useState(blank);
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedService = useMemo(() => services.find((service) => service.id === serviceId) ?? null, [services, serviceId]);
  const recurringPackages = useMemo(() => selectedService?.packages.filter((item) => {
    const billingCycle = (item.billing_cycle || item.category || "").toLowerCase();
    return item.is_active && !["one_time", "hourly"].includes(billingCycle);
  }) ?? [], [selectedService]);
  const selectedPackage = useMemo(() => selectedService?.packages.find((item) => item.id === packageId) ?? null, [selectedService, packageId]);
  const subscriptionSummary = useMemo(() => [
    { label: "Matching subscriptions", value: total, icon: Layers3, tone: "border-blue-100 bg-blue-50 text-blue-700" },
    { label: "Active", value: statusCounts.active ?? 0, icon: CheckCircle2, tone: "border-emerald-100 bg-emerald-50 text-emerald-700" },
    { label: "Paused", value: statusCounts.paused ?? 0, icon: PauseCircle, tone: "border-amber-100 bg-amber-50 text-amber-800" },
    { label: "Ended", value: (statusCounts.cancelled ?? 0) + (statusCounts.completed ?? 0), icon: CalendarDays, tone: "border-slate-200 bg-slate-50 text-slate-600" },
  ], [total, statusCounts]);

  useEffect(() => {
    if (!serviceId || !canReadServices) return;
    const sequence = ++packageRequestSequence.current;
    setPackagesLoading(true);
    void servicesApi.get(serviceId).then((service) => {
      if (sequence === packageRequestSequence.current) {
        setServices((current) => current.map((item) => item.id === service.id ? service : item));
      }
    }).catch((cause) => {
      if (sequence === packageRequestSequence.current) setError(cause instanceof Error ? cause.message : "Unable to load packages for this service.");
    }).finally(() => {
      if (sequence === packageRequestSequence.current) setPackagesLoading(false);
    });
  }, [serviceId, canReadServices]);

  useEffect(() => {
    let cancelled = false;
    setVisits([]); setVisitsError(null); setPaymentError(null); setSubscriptionDetails(null); setPayments([]);
    if (!details) return;
    setVisitsLoading(true); setPaymentsLoading(canReadPayments);
    void (async () => {
      const [detailResult, paymentResult] = await Promise.allSettled([
        servicesApi.subscriptionDetails(details.id),
        canReadPayments ? paymentsApi.subscriptionHistory(details.id) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (detailResult.status === "fulfilled") {
        setSubscriptionDetails(detailResult.value);
        setVisits(detailResult.value.sessions);
        setDetails(detailResult.value.subscription);
      } else setVisitsError(detailResult.reason instanceof Error ? detailResult.reason.message : "Unable to load subscription details.");
      if (paymentResult.status === "fulfilled" && paymentResult.value) setPayments(paymentResult.value);
      setVisitsLoading(false); setPaymentsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [details?.id, canReadPayments]);

  const initiateSessionPayment = async (visit: Booking) => {
    if (!details) return;
    const phoneNumber = paymentPhones[visit.id]?.trim();
    if (!phoneNumber) {
      setPaymentError("Enter the M-Pesa phone number to receive the STK prompt.");
      return;
    }
    setPaymentAction(visit.id);
    try {
      await paymentsApi.initiateSubscription(details.id, visit.id, phoneNumber);
      const [history, updatedDetails] = await Promise.all([
        paymentsApi.subscriptionHistory(details.id),
        servicesApi.subscriptionDetails(details.id),
      ]);
      setPayments(history);
      setSubscriptionDetails(updatedDetails);
      setVisits(updatedDetails.sessions);
      setError(null);
      setVisitsError(null);
      setPaymentError(null);
    } catch (cause) { setPaymentError(cause instanceof Error ? cause.message : "Unable to initiate M-Pesa payment."); }
    finally { setPaymentAction(null); }
  };

  const openDetails = (subscription: Subscription) => {
    setSubscriptionTab("overview");
    setDetails(subscription);
  };

  const loadSubscriptions = useCallback(async () => {
    const requestSequence = ++listRequestSequence.current;
    try {
      setError(null);
      setListLoading(true);
      const result: SubscriptionPage = await servicesApi.subscriptions({ search: search || undefined, service_id: serviceFilter || undefined, limit: pageSize, offset: (page - 1) * pageSize });
      if (requestSequence !== listRequestSequence.current) return;
      setSubscriptions(result.subscriptions);
      setStatusCounts(result.status_counts);
      setTotal(result.total);
    } catch (cause) { if (requestSequence === listRequestSequence.current) setError(cause instanceof Error ? cause.message : "Unable to load subscriptions."); }
    finally { if (requestSequence === listRequestSequence.current) setListLoading(false); }
  }, [page, pageSize, search, serviceFilter]);

  const loadCatalog = async () => {
    try {
      const [catalog, sizes] = await Promise.all([servicesApi.list(), bookingsApi.propertyTypes()]);
      setServices(catalog);
      setPropertyTypes(sizes.filter((item) => item.is_active));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load subscription options."); }
  };

  useEffect(() => { void loadCatalog(); }, []);
  useEffect(() => { void loadSubscriptions(); }, [loadSubscriptions]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
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
      setOpen(false); resetWizard(); await loadSubscriptions();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create subscription."); }
    finally { setLoading(false); }
  };
  const cancel = async (item: Subscription) => { if (!window.confirm("Cancel this subscription? Existing booking history will be kept.")) return; try { await servicesApi.updateSubscription(item.id, { status: "cancelled" }); await loadSubscriptions(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to cancel subscription."); } };

  return <div className="space-y-6">
    <PageHeader title="Subscriptions" description="Manage recurring plans, track sessions, and review payments." actions={<><Button onClick={() => { resetWizard(); setOpen(true); }}>Create subscription</Button><Button variant="outline" onClick={() => void loadSubscriptions()} disabled={listLoading}>{listLoading ? "Refreshing…" : "Refresh"}</Button></>} />
    {error && <p className="text-sm text-destructive">{error}</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{subscriptionSummary.map(({ label, value, icon: Icon, tone }) => <Card key={label} className={`flex items-center justify-between border p-4 shadow-sm ${tone}`}><div><p className="text-sm font-medium opacity-80">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{value}</p></div><Icon className="size-5 opacity-70" /></Card>)}</section>

    <Card className="p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_minmax(220px,280px)_auto] md:items-end">
        <div className="space-y-1.5"><Label htmlFor="subscription-search">Search customer</Label><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="subscription-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Name, email, or phone" className="pl-9" /></div></div>
        <div className="space-y-1.5"><Label htmlFor="subscription-service">Service</Label><select id="subscription-service" value={serviceFilter} onChange={(event) => { setServiceFilter(event.target.value); setPage(1); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">All services</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div>
        <Button type="button" variant="ghost" disabled={!searchInput && !serviceFilter} onClick={() => { setSearchInput(""); setSearch(""); setServiceFilter(""); setPage(1); }}>Clear filters</Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Search updates results as you type. Service filters apply across all subscription records.</p>
    </Card>
    <Card className="overflow-hidden"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-14">#</TableHead><TableHead>Plan</TableHead><TableHead>Customer</TableHead><TableHead>Subscription term</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Price per cycle</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{subscriptions.map((item, index) => <TableRow key={item.id}><TableCell className="font-mono text-xs text-muted-foreground">{String((page - 1) * pageSize + index + 1).padStart(2, "0")}</TableCell><TableCell className="min-w-52"><button type="button" onClick={() => openDetails(item)} className="text-left font-semibold text-blue-900 hover:underline">{item.subscription_name || "Cleaning subscription"}</button><p className="mt-1 text-xs text-muted-foreground">{item.visits_per_cycle ?? "—"} visits / {item.billing_cycle.replaceAll("_", " ")} cycle</p></TableCell><TableCell className="min-w-36">{item.customer_name || "Customer unavailable"}</TableCell><TableCell className="min-w-44"><p className="text-sm">{formatDate(item.starts_on)} – {item.ends_on ? formatDate(item.ends_on) : "Ongoing"}</p><p className="mt-1 text-xs text-muted-foreground">{item.commitment_cycles ?? "—"} cycles committed</p></TableCell><TableCell><Badge variant="outline" className={`capitalize ${statusStyles[item.status]}`}>{item.status}</Badge></TableCell><TableCell className="min-w-36 text-right"><p className="font-semibold tabular-nums">{formatMoney(item.price_per_cycle, item.currency)}</p><p className="mt-1 text-xs text-muted-foreground">per {item.billing_cycle.replaceAll("_", " ")}</p></TableCell><TableCell className="min-w-44 text-right"><Button size="sm" variant="outline" className="mr-2" onClick={() => openDetails(item)}>View</Button>{(item.status === "active" || item.status === "paused") && <Button size="sm" variant="destructive" onClick={() => void cancel(item)}>Cancel</Button>}</TableCell></TableRow>)}{!listLoading && !subscriptions.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No matching subscriptions found. Try changing the search or service filter.</TableCell></TableRow>}{listLoading && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading subscriptions…</TableCell></TableRow>}</TableBody></Table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"><p className="text-sm text-muted-foreground">{total === 0 ? "No subscriptions" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}</p><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || listLoading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button><span className="min-w-20 text-center text-sm text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span><Button size="sm" variant="outline" disabled={page >= Math.ceil(total / pageSize) || listLoading} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div></Card>

    <Dialog open={details !== null} onOpenChange={(value) => { if (!value) setDetails(null); }}>
      <DialogContent className="flex h-[min(760px,88vh)] max-w-4xl flex-col overflow-hidden">
        <DialogHeader><DialogTitle>{details?.subscription_name || "Subscription details"}</DialogTitle></DialogHeader>
        {details && <Tabs value={subscriptionTab} onValueChange={setSubscriptionTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid h-12 w-full grid-cols-3 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="sessions" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm">Sessions <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">{subscriptionDetails?.session_count ?? visits.length}</span></TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg px-1.5 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm sm:px-3 sm:text-sm"><span className="sm:hidden">Payments</span><span className="hidden sm:inline">Payment history</span><span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{payments.length}</span></TabsTrigger>
          </TabsList>
          <TabsContent value="overview" forceMount className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 data-[state=inactive]:hidden">
            <div className="flex items-center justify-between gap-4 rounded-xl border bg-slate-50 p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p><p className="mt-1 text-lg font-semibold">{details.customer_name || "Customer unavailable"}</p></div><Badge variant="outline" className={`capitalize ${statusStyles[details.status]}`}>{details.status}</Badge></div>
            <div className="grid gap-3 sm:grid-cols-3"><Card className="border-blue-100 bg-blue-50/70 p-4"><p className="text-xs font-medium text-blue-800">Price per cycle</p><p className="mt-1 text-xl font-bold text-blue-950">{formatMoney(details.price_per_cycle, details.currency)}</p><p className="mt-1 text-xs text-blue-800/75">{readableCycle(details.billing_cycle)}</p></Card><Card className="border-indigo-100 bg-indigo-50/70 p-4"><p className="text-xs font-medium text-indigo-800">Sessions generated</p><p className="mt-1 text-xl font-bold text-indigo-950">{subscriptionDetails?.session_count ?? "—"}</p><p className="mt-1 text-xs text-indigo-800/75">of {details.visits_per_cycle * details.commitment_cycles} committed visits</p></Card><Card className="border-emerald-100 bg-emerald-50/70 p-4"><p className="text-xs font-medium text-emerald-800">Commitment value</p><p className="mt-1 text-xl font-bold text-emerald-950">{subscriptionDetails?.commitment_total == null ? "—" : formatMoney(subscriptionDetails.commitment_total, details.currency)}</p><p className="mt-1 text-xs text-emerald-800/75">{details.commitment_cycles} billing cycles</p></Card></div>
            <dl className="grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{[["Visits per cycle", details.visits_per_cycle], ["Commitment", `${details.commitment_cycles} cycles`], ["Starts", formatDate(details.starts_on)], ["Ends", details.ends_on ? formatDate(details.ends_on) : "Ongoing"], ["Next service", ["cancelled", "completed"].includes(details.status) ? "No upcoming visit" : formatDate(details.next_service_date)], ["Monthly visit days", details.session_days_of_month?.length ? details.session_days_of_month.map(ordinal).join(", ") : "Not applicable"]].map(([label, value]) => <div key={String(label)}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value ?? "—"}</dd></div>)}</dl>
          </TabsContent>
          <TabsContent value="sessions" forceMount className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 data-[state=inactive]:hidden">
            <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-semibold">Subscription sessions</h3><p className="mt-1 text-sm text-muted-foreground">Schedules, cleaner assignments, and each session’s status history.</p></div><Badge variant="outline">{visits.length} total</Badge></div>
            {visitsLoading ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Loading subscription sessions…</div> : visitsError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{visitsError}</p> : visits.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No sessions have been generated for this subscription yet.</div> : visits.map((visit) => {
              const latestPayment = payments.find((payment) => payment.booking_id === visit.id);
              const retryablePayment = latestPayment && ["failed", "timed_out"].includes(latestPayment.status);
              const activePayment = latestPayment && ["initiated", "pending"].includes(latestPayment.status);
              const paymentStatusReady = !canReadPayments || !paymentsLoading;
              const canPay = canUpdatePayments && paymentStatusReady && details.status === "active" && ["pending", "awaiting_payment", "payment_failed"].includes(visit.status) && (!latestPayment || retryablePayment);
              return <article key={visit.id} className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3 bg-slate-50/80 p-4"><div><p className="font-semibold">{new Date(visit.scheduled_for).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</p><p className="mt-1 text-xs text-muted-foreground">Cycle {visit.cycle_number ?? 1} · Session {visit.session_number ?? "—"}</p></div><Badge variant="secondary" className="capitalize">{visit.status.replaceAll("_", " ")}</Badge></div><div className="space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Assigned cleaner</p><p className="mt-0.5 font-medium">{visit.cleaner?.full_name || "Not assigned"}</p></div><div className="text-left sm:text-right"><p className="text-xs text-muted-foreground">Session amount</p><p className="mt-0.5 font-semibold">{formatMoney(visit.quoted_price, visit.currency)}</p></div></div>
                {canPay && <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3"><div className="flex items-start gap-2.5"><span className="rounded-md bg-blue-100 p-2 text-blue-700"><Smartphone className="size-4" /></span><div><p className="text-sm font-semibold text-blue-950">Collect payment by M-Pesa</p><p className="mt-0.5 text-xs text-blue-800/80">Enter the phone number that should receive the STK prompt.</p></div></div><div className="flex flex-col gap-2 sm:flex-row"><Input type="tel" inputMode="tel" autoComplete="tel" aria-label="M-Pesa phone number" placeholder="e.g. 0712 345 678 or +254 712 345 678" value={paymentPhones[visit.id] ?? ""} onChange={(event) => { setPaymentPhones((current) => ({ ...current, [visit.id]: event.target.value })); setPaymentError(null); }} className="bg-white sm:max-w-sm" /><Button size="sm" className="gap-2 bg-blue-700 text-white hover:bg-blue-800" disabled={paymentAction === visit.id || (paymentPhones[visit.id] ?? "").trim().length < 10} onClick={() => void initiateSessionPayment(visit)}>{paymentAction === visit.id ? <><Loader2 className="size-4 animate-spin" />Sending request…</> : <><CreditCard className="size-4" />Send STK push</>}</Button></div></div>}
                {activePayment && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">An M-Pesa payment request is already in progress for this session.</p>}
                {!!visit.status_events?.length && <div className="border-t pt-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session history</p><div className="space-y-2">{visit.status_events.map((event, index) => <div key={`${event.created_at}-${index}`} className="flex justify-between gap-3 text-xs"><span className="capitalize">{(event.to_status ?? event.status ?? "Update").replaceAll("_", " ")}{event.note ? ` · ${event.note}` : ""}</span><span className="shrink-0 text-muted-foreground">{formatDate(event.created_at)}</span></div>)}</div></div>}
              </div></article>;
            })}
          </TabsContent>
          <TabsContent value="payments" forceMount className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 data-[state=inactive]:hidden">
            <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-semibold">Subscription payment history</h3><p className="mt-1 text-sm text-muted-foreground">Every payment attempt linked to a session in this plan.</p></div><Badge variant="outline">{payments.length} attempts</Badge></div>
            {paymentError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{paymentError}</p>}
            {!canReadPayments ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Your account does not have permission to view payment history.</div> : paymentsLoading ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Loading payment history…</div> : payments.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No payments have been recorded for this subscription.</div> : <div className="space-y-3">{payments.map((payment) => <article key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">Payment {payment.payment_number}</span><Badge variant="secondary" className="capitalize">{payment.status.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{payment.receipt_number ? `Receipt ${payment.receipt_number} · ` : ""}Invoice {payment.booking_invoice} · {payment.provider === "mpesa" ? "M-Pesa" : "Other payment"}</p><p className="mt-1 text-xs text-muted-foreground">{payment.created_at ? formatDate(payment.created_at) : "—"}</p></div><p className="text-lg font-semibold tabular-nums">{formatMoney(payment.amount, payment.currency)}</p></article>)}</div>}
          </TabsContent>
        </Tabs>}
      </DialogContent>
    </Dialog>
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetWizard(); }}><DialogContent onInteractOutside={(event) => { if (event.target instanceof Element && event.target.closest(".pac-container")) event.preventDefault(); }} className="max-h-[88vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Create subscription</DialogTitle></DialogHeader><div className="grid grid-cols-4 gap-2">{steps.map((name, index) => <div key={name} className={`rounded px-2 py-2 text-center text-xs font-medium ${index === step ? "bg-blue-950 text-white" : index < step ? "bg-blue-100 text-blue-950" : "bg-muted text-muted-foreground"}`}>{index + 1}. {name}</div>)}</div>
      {step === 0 && <div className="space-y-3"><Field label="Find customer"><Input autoFocus placeholder="Search by name, email or phone" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} /></Field><div className="space-y-2">{customers.map((item) => <button type="button" key={item.id} onClick={() => { setCustomer(item); setCustomerQuery(item.full_name); setCustomers([]); }} className={`w-full rounded-md border p-3 text-left ${customer?.id === item.id ? "border-blue-700 bg-blue-50" : "hover:bg-muted"}`}><p className="font-medium">{item.full_name}</p><p className="text-sm text-muted-foreground">{item.email || "No email"} · {item.phone || "No phone"}</p></button>)}</div>{customer && <Card className="border-blue-200 bg-blue-50 p-3 text-sm"><b>Selected:</b> {customer.full_name} · {customer.email || customer.phone}</Card>}</div>}
      {step === 1 && <div className="space-y-4"><Field label="Service"><select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setPackageId(""); setAddons({}); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select a service</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{selectedService && <><Field label="Recurring package"><div className="grid gap-2 sm:grid-cols-2">{selectedService.packages.filter((item) => item.is_active && !["one_time", "hourly"].includes(item.billing_cycle)).map((item) => <button type="button" key={item.id} onClick={() => setPackageId(item.id)} className={`rounded-md border p-3 text-left ${packageId === item.id ? "border-blue-700 bg-blue-50" : "hover:bg-muted"}`}><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.currency} {Number(item.price).toLocaleString()} · {item.billing_cycle}</p><p className="text-xs text-muted-foreground">{item.visits_per_cycle ?? 1} visit(s) per cycle · {item.billing_cycle === "monthly" ? "1 month by default" : `${item.commitment_cycles ?? "—"} cycles`}</p></button>)}</div></Field><div><Label>Add-ons (optional)</Label><div className="mt-2 space-y-2">{selectedService.additional_services.filter((item) => item.is_active).map((item) => <div key={item.id} className="flex items-center justify-between rounded border p-3"><div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.currency} {Number(item.rate).toLocaleString()} {item.applies_per_session ? "per session" : "once"}</p></div><div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setAddons({ ...addons, [item.id]: Math.max(0, (addons[item.id] ?? 0) - 1) })}>−</Button><span className="w-5 text-center">{addons[item.id] ?? 0}</span><Button type="button" size="sm" variant="outline" disabled={(addons[item.id] ?? 0) >= (item.maximum_quantity ?? 100)} onClick={() => setAddons({ ...addons, [item.id]: (addons[item.id] ?? 0) + 1 })}>+</Button></div></div>)}</div></div></>}</div>}
      {step === 1 && serviceId && packagesLoading && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Refreshing packages for this service…</p>}
      {step === 1 && serviceId && !packagesLoading && recurringPackages.length === 0 && <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">No active recurring packages for this service</p><p className="mt-1">Add an active monthly, fortnightly, or other recurring package in Services. One-time and hourly packages cannot be used for subscriptions.</p></Card>}
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
