import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarRange, CheckCircle2, CircleAlert, Clock3, CreditCard, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { analyticsApi, servicesApi, type DecisionKpi, type DecisionSection, type DecisionSummary } from "@/lib/api";

export const Route = createFileRoute("/_dash/analytics")({ component: AnalyticsPage });

type Granularity = "daily" | "weekly" | "monthly";
type PeriodPreset = "7" | "30" | "90" | "custom";
const palette = ["#2563eb", "#0d9488", "#8b5cf6", "#f59e0b", "#e11d48", "#0891b2"];
const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const shiftDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const numeric = (value: unknown) => typeof value === "number" ? value : Number(value ?? 0) || 0;
const numberFormat = (value: number) => new Intl.NumberFormat("en-KE", { maximumFractionDigits: 1 }).format(value);
const moneyFormat = (value: number, currency: string, compact = false) => new Intl.NumberFormat("en-KE", { style: "currency", currency, notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 0 }).format(value);
const initialEnd = dateValue(new Date());
const initialStart = dateValue(shiftDays(new Date(), -29));

type UsageSummary = { total_bookings: number; total_active_subscriptions: number; services: Array<{ service_name: string; bookings: number; completed_bookings: number; active_subscriptions: number; quoted_value: string | number; currency: string }> };

function AnalyticsPage() {
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [preset, setPreset] = useState<PeriodPreset>("30");
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [decision, setDecision] = useState<DecisionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = async (start = startDate, end = endDate, interval = granularity) => {
    if (!start || !end || start > end) { setError("Choose a valid start and end date."); return; }
    if ((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000 > 366) { setError("Choose a reporting period of 366 days or less."); return; }
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    const [usageResult, decisionResult] = await Promise.allSettled([
      servicesApi.usage(start, end),
      analyticsApi.decisionSummary({ start_date: start, end_date: end, granularity: interval }),
    ]);
    if (requestId !== requestSequence.current) return;
    if (usageResult.status === "fulfilled") setUsage(usageResult.value);
    if (decisionResult.status === "fulfilled") setDecision(decisionResult.value);
    const issues = [usageResult, decisionResult].filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => result.reason instanceof Error ? result.reason.message : "Unable to load analytics.");
    if (issues.length) setError(issues.join(" "));
    setLoading(false);
  };

  useEffect(() => { void load(initialStart, initialEnd, "daily"); }, []);

  const applyPreset = (days: Exclude<PeriodPreset, "custom">) => {
    const end = dateValue(new Date());
    const start = dateValue(shiftDays(new Date(), 1 - Number(days)));
    setPreset(days); setStartDate(start); setEndDate(end);
    void load(start, end, granularity);
  };
  const changeGranularity = (interval: Granularity) => { setGranularity(interval); void load(startDate, endDate, interval); };
  const resetPeriod = () => {
    const end = dateValue(new Date()); const start = dateValue(shiftDays(new Date(), -29));
    setPreset("30"); setStartDate(start); setEndDate(end); setGranularity("daily");
    void load(start, end, "daily");
  };

  const bookings = sectionByKey(decision, "bookings");
  const payments = sectionByKey(decision, "payments");
  const finance = sectionByKey(decision, "finance");
  const operations = sectionByKey(decision, "operations");
  const currency = decision?.currency || usage?.services[0]?.currency || "KES";
  const serviceData = useMemo(() => usage?.services.slice().sort((a, b) => b.bookings - a.bookings) ?? [], [usage]);
  const completionData = useMemo(() => serviceData.map((service) => {
    const completion = service.bookings ? Math.round(service.completed_bookings / service.bookings * 100) : 0;
    return { name: service.service_name, complete: completion, incomplete: 100 - completion };
  }), [serviceData]);
  const subscriptionData = useMemo(() => serviceData.map((service) => ({ name: service.service_name, subscriptions: service.active_subscriptions })), [serviceData]);
  const quotedByCurrency = useMemo(() => Object.entries(serviceData.reduce<Record<string, number>>((totals, service) => {
    totals[service.currency] = (totals[service.currency] ?? 0) + numeric(service.quoted_value);
    return totals;
  }, {})).map(([code, total]) => ({ currency: code, total })), [serviceData]);
  const bookingTrend = useMemo(() => combineSeries(bookings?.series ?? [], ["booking_volume", "cancellations"]), [bookings]);
  const paymentTrend = useMemo(() => combineSeries(payments?.series ?? [], ["collections", "payment_failures"]), [payments]);

  const metrics = [
    { title: "Bookings", kpi: findKpi(bookings, "booking_volume"), fallback: usage?.total_bookings, kind: "number" as const, icon: <BarChart3 className="size-5" />, tone: "blue" as const },
    { title: "Cancellations", kpi: findKpi(bookings, "cancellations"), kind: "number" as const, icon: <CircleAlert className="size-5" />, tone: "rose" as const },
    { title: "Completion rate", kpi: findKpi(bookings, "completion_rate"), kind: "percent" as const, icon: <CheckCircle2 className="size-5" />, tone: "teal" as const },
    { title: "Payment success", kpi: findKpi(payments, "payment_success_rate"), kind: "percent" as const, icon: <CreditCard className="size-5" />, tone: "violet" as const },
    { title: "Pending collection", kpi: findKpi(finance, "pending_collection"), kind: "currency" as const, icon: <Clock3 className="size-5" />, tone: "amber" as const },
  ];
  const financeMetrics = [
    { title: "Gross earnings", kpi: findKpi(finance, "gross_earnings"), kind: "currency" as const, icon: <Wallet className="size-5" />, tone: "emerald" as const },
    { title: "Cleaner payouts paid", kpi: findKpi(finance, "cleaner_payouts"), kind: "currency" as const, icon: <Wallet className="size-5" />, tone: "teal" as const },
    { title: "Company earnings retained", kpi: findKpi(finance, "company_earnings"), kind: "currency" as const, icon: <Wallet className="size-5" />, tone: "blue" as const },
  ];
  const watchMetrics = [
    { title: "Active workload", kpi: findKpi(bookings, "active_workload"), tone: "blue" as const },
    { title: "Awaiting assignment", kpi: findKpi(operations, "awaiting_assignment"), tone: "amber" as const },
    { title: "Urgent support tickets", kpi: findKpi(operations, "urgent_support_tickets"), tone: "rose" as const },
  ];

  return <div className="space-y-6 pb-8">
    <PageHeader title="Analytics" description="Business performance across demand, service delivery, payments, and finance." actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Updating" : "Refresh"}</Button>} />

    <Card className="border-slate-200 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto"><p className="text-sm font-semibold">Reporting period</p><p className="mt-1 text-xs text-muted-foreground">Compare performance with the previous equal-length period.</p></div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">{(["7", "30", "90"] as const).map((days) => <Button key={days} type="button" size="sm" variant={preset === days ? "default" : "ghost"} className="h-8 px-3" onClick={() => applyPreset(days)}>Last {days} days</Button>)}<Button type="button" size="sm" variant={preset === "custom" ? "default" : "ghost"} className="h-8 px-3" onClick={() => setPreset("custom")}>Custom</Button></div>
        {preset === "custom" && <div className="flex flex-wrap items-end gap-2"><div className="grid gap-1"><Label htmlFor="analytics-start" className="text-xs text-muted-foreground">From</Label><Input id="analytics-start" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="h-9 w-36" /></div><span className="pb-2 text-muted-foreground">–</span><div className="grid gap-1"><Label htmlFor="analytics-end" className="text-xs text-muted-foreground">To</Label><Input id="analytics-end" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="h-9 w-36" /></div><Button type="button" size="sm" className="h-9" onClick={() => void load()} disabled={loading}>Apply period</Button></div>}
        <div className="flex items-center gap-1 rounded-lg border bg-background p-1"><span className="px-2 text-xs text-muted-foreground">Group by</span>{(["daily", "weekly", "monthly"] as const).map((interval) => <Button key={interval} type="button" size="sm" variant={granularity === interval ? "secondary" : "ghost"} className="h-7 px-2.5 capitalize" onClick={() => changeGranularity(interval)}>{interval}</Button>)}</div>
        <Button type="button" variant="ghost" size="sm" className="h-9" onClick={resetPeriod}>Reset</Button>
      </div>
      {decision?.comparison_start_date && <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground"><CalendarRange className="size-4" />Comparing <span className="font-medium text-foreground">{decision.start_date} – {decision.end_date}</span> with <span className="font-medium text-foreground">{decision.comparison_start_date} – {decision.comparison_end_date}</span></div>}
    </Card>

    {error && <Card role="alert" className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</Card>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((item) => <AnalyticsMetricCard key={item.title} title={item.title} metric={item.kpi} fallback={item.fallback} kind={item.kind} currency={currency} icon={item.icon} tone={item.tone} loading={loading} />)}
    </section>

    <section aria-labelledby="finance-summary-title" className="space-y-3">
      <div><h2 id="finance-summary-title" className="font-semibold">Finance summary</h2><p className="mt-1 text-sm text-muted-foreground">Gross booking earnings, cleaner payouts already paid, and the company share retained for the selected period.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {financeMetrics.map((item) => <AnalyticsMetricCard key={item.title} title={item.title} metric={item.kpi} kind={item.kind} currency={currency} icon={item.icon} tone={item.tone} loading={loading} />)}
      </div>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <TrendPanel title="Bookings & cancellations" description="Bookings created compared with cancellations recorded in each period." data={bookingTrend} colors={["#2563eb", "#e11d48"]} loading={loading} />
      <TrendPanel title="Payment performance" description="Successful collections and failed or timed-out payment value." data={paymentTrend} colors={["#059669", "#f59e0b"]} currency={currency} loading={loading} />
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card className="p-5 shadow-sm"><ChartHeading title="Service demand" description="Bookings by service, highest demand first." /><div className="mt-4 h-80">{serviceData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={serviceData.slice(0, 10)} layout="vertical" margin={{ left: 12, right: 16 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis dataKey="service_name" type="category" width={130} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="bookings" name="Bookings" radius={[0, 6, 6, 0]}>{serviceData.slice(0, 10).map((service, index) => <Cell key={service.service_name} fill={palette[index % palette.length]} />)}</Bar></BarChart></ResponsiveContainer> : <ChartEmpty loading={loading} />}</div></Card>
      <Card className="p-5 shadow-sm"><ChartHeading title="Completion by service" description="Share of bookings completed for each service." /><div className="mt-4 h-80">{completionData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={completionData.slice(0, 10)} layout="vertical" margin={{ left: 12, right: 16 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} /><YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => `${numberFormat(Number(value))}%`} /><Legend /><Bar dataKey="complete" name="Completed" stackId="rate" fill="#0d9488" /><Bar dataKey="incomplete" name="Not completed" stackId="rate" fill="#e2e8f0" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer> : <ChartEmpty loading={loading} />}</div></Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-3">
      <Card className="p-5 shadow-sm"><ChartHeading title="Recurring subscriptions" description="Active recurring plans by service." /><div className="mt-4 h-72">{subscriptionData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={subscriptionData.slice(0, 8)}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={58} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="subscriptions" name="Active plans" fill="#8b5cf6" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <ChartEmpty loading={loading} />}</div></Card>
      <Card className="p-5 shadow-sm xl:col-span-2"><ChartHeading title="Quoted value by currency" description="Totals stay separated so different currencies are never combined." /><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{quotedByCurrency.length ? quotedByCurrency.map((item, index) => <div key={item.currency} className="rounded-xl border p-4" style={{ borderColor: `${palette[index % palette.length]}50`, background: `${palette[index % palette.length]}0D` }}><p className="text-sm font-medium text-muted-foreground">{item.currency}</p><p className="mt-2 text-2xl font-bold tabular-nums" style={{ color: palette[index % palette.length] }}>{moneyFormat(item.total, item.currency, true)}</p></div>) : <div className="col-span-full"><ChartEmpty loading={loading} /></div>}</div><p className="mt-4 text-xs text-muted-foreground">Quoted booking value is an estimate of requested work, not collected revenue.</p></Card>
    </section>

    <section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h2 className="font-semibold">Operational & finance watch</h2><p className="mt-1 text-sm text-muted-foreground">Signals worth checking alongside growth.</p></div><Badge variant="outline">Selected period</Badge></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{watchMetrics.map((item) => <WatchMetric key={item.title} title={item.title} metric={item.kpi} currency={currency} tone={item.tone} loading={loading} />)}</div></section>

    {decision?.limitations?.length ? <Card className="border-slate-200 bg-slate-50/70 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">How to read these figures</p><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{decision.limitations.map((note) => <li key={note}>• {note}</li>)}</ul></Card> : null}
  </div>;
}

function sectionByKey(summary: DecisionSummary | null, key: DecisionSection["key"]) { return summary?.sections?.find((section) => section.key === key); }
function findKpi(section: DecisionSection | undefined, key: string) { return section?.kpis.find((item) => item.key === key); }
function combineSeries(series: DecisionSection["series"], keys: string[]) {
  const rows = new Map<string, Record<string, string | number>>();
  series.filter((item) => keys.includes(item.key)).forEach((item) => item.points.forEach((point) => rows.set(point.date, { ...(rows.get(point.date) ?? { date: point.date }), [item.label]: numeric(point.value) })));
  return [...rows.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
function formatDateTick(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function formatDateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
function formatMetric(metric: DecisionKpi | undefined, fallback: number | undefined, kind: "number" | "percent" | "currency", currency: string) {
  const raw = metric?.value ?? fallback;
  if (raw == null) return "—";
  const value = numeric(raw);
  if (kind === "currency") return moneyFormat(value, currency, true);
  if (kind === "percent") return `${numberFormat(value)}%`;
  return numberFormat(value);
}
function changeLabel(metric?: DecisionKpi) {
  if (typeof metric?.delta_percentage !== "number") return metric?.direction === "new" ? "New this period" : "Compared with previous period";
  return `${Math.abs(metric.delta_percentage).toFixed(1)}% vs previous period`;
}

function AnalyticsMetricCard({ title, metric, fallback, kind, currency, icon, tone, loading }: { title: string; metric?: DecisionKpi; fallback?: number; kind: "number" | "percent" | "currency"; currency: string; icon: React.ReactNode; tone: "blue" | "rose" | "teal" | "emerald" | "violet" | "amber"; loading: boolean }) {
  const styles = { blue: "border-blue-200 bg-blue-50/80 text-blue-950", rose: "border-rose-200 bg-rose-50/80 text-rose-950", teal: "border-teal-200 bg-teal-50/80 text-teal-950", emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-950", violet: "border-violet-200 bg-violet-50/80 text-violet-950", amber: "border-amber-200 bg-amber-50/80 text-amber-950" };
  const direction = metric?.direction;
  return <Card className={`min-h-36 border p-4 shadow-sm ${styles[tone]}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-slate-600">{title}</p><span className="rounded-lg bg-white/80 p-2">{icon}</span></div><p className="mt-3 break-words text-2xl font-bold tabular-nums sm:text-3xl">{loading && !metric && fallback == null ? "…" : formatMetric(metric, fallback, kind, currency)}</p><div className="mt-2 flex items-center gap-1 text-xs text-slate-600">{metric?.delta_percentage != null && (direction === "down" ? <ArrowDownRight className="size-3.5 text-rose-600" /> : <ArrowUpRight className="size-3.5 text-emerald-600" />)}{changeLabel(metric)}</div></Card>;
}

function TrendPanel({ title, description, data, colors, loading, currency }: { title: string; description: string; data: Array<Record<string, string | number>>; colors: string[]; loading: boolean; currency?: string }) {
  const seriesNames = [...new Set(data.flatMap((row) => Object.keys(row).filter((key) => key !== "date")))];
  return <Card className="p-5 shadow-sm"><div className="mb-4"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><div className="h-72">{data.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ left: -12, right: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={formatDateTick} tick={{ fontSize: 11 }} minTickGap={24} /><YAxis tick={{ fontSize: 11 }} allowDecimals={Boolean(currency)} tickFormatter={(value) => currency ? `${currency} ${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 }).format(Number(value))}` : numberFormat(Number(value))} /><Tooltip labelFormatter={(value) => formatDateLabel(String(value))} formatter={(value, name) => [currency ? moneyFormat(Number(value), currency) : numberFormat(Number(value)), name]} /><Legend />{seriesNames.map((name, index) => <Line key={name} type="monotone" dataKey={name} name={name} stroke={colors[index % colors.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />)}</LineChart></ResponsiveContainer> : <ChartEmpty loading={loading} />}</div></Card>;
}
function ChartHeading({ title, description }: { title: string; description: string }) { return <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>; }
function ChartEmpty({ loading }: { loading: boolean }) { return <div className="grid h-full place-items-center rounded-xl border border-dashed bg-muted/20 px-6 text-center text-sm text-muted-foreground">{loading ? "Loading data…" : "No data is available for this period."}</div>; }
function WatchMetric({ title, metric, currency, tone, loading }: { title: string; metric?: DecisionKpi; currency: string; tone: "blue" | "amber" | "rose" | "teal"; loading: boolean }) {
  const styles = { blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700", teal: "bg-teal-50 text-teal-700" };
  const kind = metric?.unit === "currency" ? "currency" : metric?.unit === "percent" ? "percent" : "number";
  return <Card className="flex items-center justify-between gap-3 p-4"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold tabular-nums">{loading && !metric ? "…" : formatMetric(metric, undefined, kind, currency)}</p></div><span className={`rounded-lg p-2.5 ${styles[tone]}`}><TrendingUp className="size-4" /></span></Card>;
}
