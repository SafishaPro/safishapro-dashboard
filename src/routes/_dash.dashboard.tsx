import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, CircleAlert, ClipboardList, Clock3, CreditCard, RefreshCw, Sparkles, TrendingUp, Users, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { analyticsApi, dashboardApi, type DashboardSection, type DashboardSummary, type DecisionKpi, type DecisionPoint, type DecisionSection, type DecisionSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_dash/dashboard")({ component: DashboardPage });

type Granularity = "daily" | "weekly" | "monthly";
type WindowPreset = "7" | "30" | "90" | "custom";
const dateString = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const formatRangeDate = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(",", "");
};
const shiftDate = (value: Date, days: number) => { const next = new Date(value); next.setDate(next.getDate() + days); return next; };
const today = dateString(new Date());
const defaultStart = dateString(shiftDate(new Date(), -29));
const chartColors = ["#2563eb", "#14b8a6", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#84cc16"];
const currencyFormat = (value: number, currency: string, compact = false) => new Intl.NumberFormat("en-KE", { style: "currency", currency, notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 0 }).format(value);
const numberFormat = (value: number) => new Intl.NumberFormat("en-KE", { maximumFractionDigits: 1 }).format(value);

function DashboardPage() {
  const { can } = useAuth();
  const [windowPreset, setWindowPreset] = useState<WindowPreset>("30");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [analytics, setAnalytics] = useState<DecisionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (start = startDate, end = endDate, step = granularity) => {
    if (!start || !end || start > end) { setError("Choose a valid reporting period."); return; }
    if (Math.ceil((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) > 366) { setError("Choose a reporting period of 366 days or less."); return; }
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      dashboardApi.summary({ start_date: start, end_date: end, granularity: step }),
      can("analytics.read") ? analyticsApi.decisionSummary({ start_date: start, end_date: end, granularity: step }) : Promise.resolve(null),
    ]);
    const dashboardResult = results[0];
    const analyticsResult = results[1];
    if (dashboardResult.status === "fulfilled") setDashboard(dashboardResult.value);
    else setError(dashboardResult.reason instanceof Error ? dashboardResult.reason.message : "Unable to load dashboard data.");
    if (analyticsResult.status === "fulfilled") setAnalytics(analyticsResult.value);
    else if (analyticsResult.reason) setError(analyticsResult.reason instanceof Error ? analyticsResult.reason.message : "Unable to load business analytics.");
    setLoading(false);
  };

  useEffect(() => { void load(defaultStart, today, "daily"); }, []);

  const applyPreset = (preset: Exclude<WindowPreset, "custom">) => {
    const end = dateString(new Date());
    const start = dateString(shiftDate(new Date(), 1 - Number(preset)));
    setWindowPreset(preset);
    setStartDate(start);
    setEndDate(end);
    void load(start, end, granularity);
  };
  const applyGranularity = (step: Granularity) => { setGranularity(step); void load(startDate, endDate, step); };
  const resetPeriod = () => {
    const end = dateString(new Date());
    const start = dateString(shiftDate(new Date(), -29));
    setWindowPreset("30"); setStartDate(start); setEndDate(end); setGranularity("daily");
    void load(start, end, "daily");
  };

  const bookingSection = findDecisionSection(analytics, "bookings");
  const paymentSection = findDecisionSection(analytics, "payments");
  const financeSection = findDecisionSection(analytics, "finance");
  const operationsSection = findDecisionSection(analytics, "operations");
  const operationsDashboard = dashboard?.sections.find((section) => section.key === "operations");
  const workforceDashboard = dashboard?.sections.find((section) => section.key === "workforce");
  const currency = typeof analytics?.currency === "string" && analytics.currency ? analytics.currency : "KES";

  const cards = [
    { title: "Bookings", href: "/bookings", metric: findMetric(bookingSection, ["booking_volume"]) ?? findDashboardMetric(operationsDashboard, ["bookings"]), icon: <ClipboardList className="size-5" />, tone: "blue" as const, unit: "count" },
    { title: "Gross earnings", href: "/analytics", metric: findMetric(financeSection, ["gross_earnings"]) ?? findMetric(financeSection, ["collected_revenue"]) ?? findMetric(paymentSection, ["successful_collections"]), icon: <Wallet className="size-5" />, tone: "emerald" as const, unit: "currency" },
    { title: "Cleaner payouts paid", href: "/payouts", metric: findMetric(financeSection, ["cleaner_payouts"]), icon: <Wallet className="size-5" />, tone: "teal" as const, unit: "currency" },
    { title: "Company earnings", href: "/analytics", metric: findMetric(financeSection, ["company_earnings"]), icon: <Wallet className="size-5" />, tone: "blue" as const, unit: "currency" },
    { title: "Payment success", href: "/payments", metric: findMetric(paymentSection, ["payment_success_rate"]), icon: <CreditCard className="size-5" />, tone: "violet" as const, unit: "percent" },
    { title: "Completion rate", href: "/bookings", metric: findMetric(bookingSection, ["completion_rate"]) ?? findDashboardMetric(operationsDashboard, ["completion_rate"]), icon: <CheckCircle2 className="size-5" />, tone: "teal" as const, unit: "percent" },
    { title: "Cancellations", href: "/bookings", metric: findMetric(bookingSection, ["cancellations"]) ?? findDashboardMetric(operationsDashboard, ["cancellations"]), icon: <CircleAlert className="size-5" />, tone: "rose" as const, unit: "count" },
    { title: "Active workload", href: "/bookings", metric: findMetric(bookingSection, ["active_workload"]) ?? findDashboardMetric(operationsDashboard, ["active_bookings"]), icon: <Activity className="size-5" />, tone: "amber" as const, unit: "count" },
    { title: "Pending collection", href: "/payments", metric: findMetric(financeSection, ["pending_collection"]), icon: <Clock3 className="size-5" />, tone: "rose" as const, unit: "currency" },
    ...(can("cleaners.read") && can("bookings.read") ? [{ title: "Active cleaners", href: "/cleaners", metric: findDashboardMetric(operationsDashboard, ["recently_active_cleaners"]), icon: <Users className="size-5" />, tone: "emerald" as const, unit: "count" }] : []),
    ...(can("bookings.read") ? [{ title: "Repeat customers", href: can("customers.read") ? "/customers" : "/bookings", metric: findDashboardMetric(operationsDashboard, ["repeat_customers"]), icon: <Users className="size-5" />, tone: "violet" as const, unit: "count" }] : []),
  ];

  const bookingTrend = findSeries(bookingSection, ["booking_volume"]) ?? findDashboardTrend(operationsDashboard, "booking_volume");
  const cancellationTrend = findSeries(bookingSection, ["cancellations"]) ?? findDashboardTrend(operationsDashboard, "cancellations");
  const revenueTrend = findSeries(financeSection, ["revenue"]) ?? findSeries(paymentSection, ["collections"]);
  const paymentRiskTrend = findSeries(paymentSection, ["payment_failures"]);
  const serviceDemand = normaliseBreakdowns(bookingSection?.breakdowns);
  const statusBreakdown = (operationsDashboard?.breakdowns ?? []).filter((item) => item.key.startsWith("status:"));
  const activeUsers = findDashboardMetric(workforceDashboard, ["active_users"]);
  const totalUsers = findDashboardMetric(workforceDashboard, ["total_users"]);

  return <div className="space-y-6 pb-8">
    <section className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 px-5 py-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-blue-950/40 dark:to-indigo-950/30 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300"><Sparkles className="size-3.5" /> Executive overview</span><span className="text-xs text-slate-500 dark:text-slate-400">{formatRangeDate(startDate)} - {formatRangeDate(endDate)}{analytics?.comparison_start_date && ` · compared with ${formatRangeDate(analytics.comparison_start_date)} - ${formatRangeDate(analytics.comparison_end_date)}`}</span></div><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Business at a glance</h1><p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">Demand, collections, delivery, and operational health.</p></div>
        <Button onClick={() => void load()} disabled={loading} variant="outline" className="shrink-0 gap-2 border-blue-200 bg-white/70 text-slate-800 hover:bg-white dark:border-slate-600 dark:bg-slate-900/40 dark:text-white"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Updating" : "Refresh"}</Button>
      </div>
    </section>

    <Card className="border-slate-200 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto"><p className="text-sm font-semibold">Reporting period</p><p className="mt-1 text-xs text-muted-foreground">Choose the window and trend interval for the overview.</p></div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">{(["7", "30", "90"] as const).map((days) => <Button key={days} type="button" size="sm" variant={windowPreset === days ? "default" : "ghost"} className="h-8 px-3" onClick={() => applyPreset(days)}>Last {days} days</Button>)}<Button type="button" size="sm" variant={windowPreset === "custom" ? "default" : "ghost"} className="h-8 px-3" onClick={() => setWindowPreset("custom")}>Custom</Button></div>
        <div className="flex flex-wrap items-end gap-2">{windowPreset === "custom" && <><div className="grid gap-1"><Label htmlFor="dashboard-start" className="text-xs text-muted-foreground">From</Label><Input id="dashboard-start" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="h-9 w-36" /></div><span className="pb-2 text-muted-foreground">–</span><div className="grid gap-1"><Label htmlFor="dashboard-end" className="text-xs text-muted-foreground">To</Label><Input id="dashboard-end" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="h-9 w-36" /></div><Button type="button" size="sm" className="h-9" onClick={() => void load()} disabled={loading}>Apply period</Button></>}</div>
        <div className="flex items-center gap-1 rounded-lg border bg-background p-1"><span className="px-2 text-xs text-muted-foreground">Group by</span>{(["daily", "weekly", "monthly"] as const).map((step) => <Button key={step} type="button" size="sm" variant={granularity === step ? "secondary" : "ghost"} className="h-7 px-2.5 capitalize" onClick={() => applyGranularity(step)}>{step}</Button>)}</div>
        <Button type="button" variant="ghost" size="sm" className="h-9" onClick={resetPeriod}>Reset</Button>
      </div>
    </Card>

    {error && <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</Card>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => <Link key={card.title} to={card.href} aria-label={`Open ${card.title}`} className="group block cursor-pointer rounded-xl outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><ExecutiveMetric title={card.title} metric={card.metric} icon={card.icon} tone={card.tone} unit={card.unit} currency={currency} loading={loading} /></Link>)}
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <TrendCard title="Bookings & cancellations" description="New bookings and cancellations recorded in each period." trend={bookingTrend} secondary={cancellationTrend} color="#2563eb" loading={loading} />
      <TrendCard title="Collected revenue" description="Successful customer payments over time." trend={revenueTrend} secondary={paymentRiskTrend} color="#059669" loading={loading} currency={currency} />
    </section>

    <section className="grid gap-4 xl:grid-cols-5">
      <Card className="overflow-hidden p-5 xl:col-span-3"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="font-semibold">Where demand is coming from</h2><p className="mt-1 text-sm text-muted-foreground">Bookings by service for this period.</p></div><Badge variant="secondary" className="shrink-0"><TrendingUp className="mr-1 size-3.5" />Top services</Badge></div><div className="h-80">{serviceDemand.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={serviceDemand.slice(0, 8)} layout="vertical" margin={{ left: 12, right: 16 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis dataKey="label" type="category" width={130} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name="Bookings" radius={[0, 6, 6, 0]}>{serviceDemand.slice(0, 8).map((entry, index) => <Cell key={entry.label} fill={chartColors[index % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer> : <ChartEmpty loading={loading} message="Service demand will appear when booking analytics are available." />}</div></Card>
      <Card className="p-5 xl:col-span-2"><div className="mb-4"><h2 className="font-semibold">Booking status mix</h2><p className="mt-1 text-sm text-muted-foreground">Current lifecycle of bookings created in this window.</p></div><div className="h-80">{statusBreakdown.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusBreakdown} dataKey="value" nameKey="label" innerRadius="53%" outerRadius="76%" paddingAngle={2}>{statusBreakdown.map((entry, index) => <Cell key={entry.key} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" height={52} formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} /></PieChart></ResponsiveContainer> : <ChartEmpty loading={loading} message="Booking status distribution is not available for your account." />}</div></Card>
    </section>

    <section className="grid gap-4 lg:grid-cols-3">
      <Link to="/bookings" aria-label="Open bookings" className="group cursor-pointer rounded-xl outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><WatchCard title="Awaiting assignment" metric={findMetric(operationsSection, ["awaiting_assignment"]) ?? findDashboardMetric(operationsDashboard, ["awaiting_assignment"])} icon={<Clock3 className="size-5" />} tone="amber" loading={loading} /></Link>
      <Link to="/tickets" aria-label="Open support tickets" className="group cursor-pointer rounded-xl outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><WatchCard title="Open support tickets" metric={findMetric(operationsSection, ["open_support_tickets"])} icon={<CircleAlert className="size-5" />} tone="rose" loading={loading} /></Link>
      <Link to="/staff" aria-label="Open staff" className="group cursor-pointer rounded-xl outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><WatchCard title="Active users" metric={findDashboardMetric(workforceDashboard, ["active_users"])} icon={<Users className="size-5" />} tone="blue" loading={loading} detail={totalUsers ? `${formatRaw(totalUsers.value)} total accounts` : undefined} /></Link>
    </section>

    {!can("analytics.read") && <Card className="border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">Revenue, payment conversion, and service demand charts require analytics access. Contact an administrator if you need those insights.</Card>}
    <p className="text-right text-xs text-muted-foreground">{dashboard?.period.timezone ? `Business reporting timezone: ${dashboard.period.timezone}` : ""}{dashboard?.generated_at ? ` · Updated ${new Date(dashboard.generated_at).toLocaleString()}` : ""}</p>
  </div>;
}

function normaliseKpis(section?: DecisionSection): DecisionKpi[] {
  if (!section?.kpis) return [];
  if (Array.isArray(section.kpis)) return section.kpis;
  return Object.entries(section.kpis).map(([key, value]) => typeof value === "object" && value !== null ? { key, ...(value as DecisionKpi) } : { key, value });
}
function findDecisionSection(summary: DecisionSummary | null, key: DecisionSection["key"]): DecisionSection | undefined { return summary?.sections.find((section) => section.key === key); }
function findMetric(section: DecisionSection | undefined, keys: string[]): DecisionKpi | undefined { return normaliseKpis(section).find((metric) => keys.includes(String(metric.key))); }
function findDashboardMetric(section: DashboardSection | undefined, keys: string[]) { return section?.kpis.find((metric) => keys.includes(metric.key)); }
function findSeries(section: DecisionSection | undefined, keys: string[]): { label: string; points: DecisionPoint[] } | undefined {
  const source = section?.series;
  if (!source) return undefined;
  const entries = source.map((item) => [item.key, { label: item.label, points: item.points }] as const);
  return entries.find(([key, value]) => keys.includes(key) || keys.includes(value.label.toLowerCase().replaceAll(" ", "_")))?.[1];
}
function findDashboardTrend(section: DashboardSection | undefined, key: string): { label: string; points: DecisionPoint[] } | undefined {
  const trend = section?.trends.find((item) => item.key === key);
  return trend ? { label: trend.label, points: trend.points } : undefined;
}
function normaliseBreakdowns(value: DecisionSection["breakdowns"]): Array<{ label: string; value: number }> {
  if (!value) return [];
  const items = Array.isArray(value) ? value : Object.entries(value).map(([label, item]) => typeof item === "object" && item !== null ? { label, ...(item as Record<string, unknown>) } : { label, value: item });
  return items.map((item, index) => ({ label: String(item.label ?? item.name ?? item.key ?? `Item ${index + 1}`), value: Number(item.value ?? item.count ?? item.total ?? 0) || 0 })).filter((item) => item.value > 0);
}
function formatRaw(value: unknown) { return value == null ? "—" : typeof value === "number" ? numberFormat(value) : String(value); }
function metricValue(metric: DecisionKpi | DashboardSection["kpis"][number] | undefined, unit: string, currency: string) {
  if (!metric || metric.value == null) return "—";
  const value = typeof metric.value === "number" ? metric.value : Number(metric.value);
  if (!Number.isFinite(value)) return String(metric.value);
  if (unit === "currency") return currencyFormat(value, currency, true);
  if (unit === "percent") return `${numberFormat(value)}%`;
  return numberFormat(value);
}

function ExecutiveMetric({ title, metric, icon, tone, unit, currency, loading }: { title: string; metric?: DecisionKpi | DashboardSection["kpis"][number]; icon: React.ReactNode; tone: "blue" | "emerald" | "violet" | "teal" | "amber" | "rose"; unit: string; currency: string; loading: boolean }) {
  const styles = {
    blue: "border-blue-200 bg-gradient-to-br from-blue-50 to-white text-blue-950 dark:from-blue-950/40 dark:to-card dark:text-blue-100",
    emerald: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-950 dark:from-emerald-950/40 dark:to-card dark:text-emerald-100",
    violet: "border-violet-200 bg-gradient-to-br from-violet-50 to-white text-violet-950 dark:from-violet-950/40 dark:to-card dark:text-violet-100",
    teal: "border-teal-200 bg-gradient-to-br from-teal-50 to-white text-teal-950 dark:from-teal-950/40 dark:to-card dark:text-teal-100",
    amber: "border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-950 dark:from-amber-950/40 dark:to-card dark:text-amber-100",
    rose: "border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-950 dark:from-rose-950/40 dark:to-card dark:text-rose-100",
  };
  const delta = metric?.delta_percentage;
  const direction = metric?.direction;
  const note = metric && "note" in metric && typeof metric.note === "string" ? metric.note : metric && "description" in metric && typeof metric.description === "string" ? metric.description : "For the selected reporting period";
  return <Card className={`min-h-40 border p-5 shadow-sm transition-all duration-200 group-hover:border-blue-600 group-hover:bg-blue-600 group-hover:bg-none group-hover:text-white group-hover:shadow-lg ${styles[tone]}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-blue-50">{title}</p><span className="rounded-xl bg-white/80 p-2.5 text-current shadow-sm transition-colors dark:bg-white/10 group-hover:bg-white group-hover:text-blue-700">{icon}</span></div><p className="mt-4 break-words text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{loading && !metric ? "…" : metricValue(metric, unit, currency)}</p><div className="mt-3 flex min-h-5 items-center gap-1.5 text-xs">{typeof delta === "number" ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${direction === "down" ? "bg-rose-100 text-rose-700" : direction === "up" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{direction === "down" ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}{Math.abs(delta).toFixed(1)}% vs previous period</span> : <span className="text-slate-500 dark:text-slate-400 group-hover:text-blue-50">{note}</span>}</div></Card>;
}

function TrendCard({ title, description, trend, secondary, color, loading, currency }: { title: string; description: string; trend?: { label: string; points: DecisionPoint[] }; secondary?: { label: string; points: DecisionPoint[] }; color: string; loading: boolean; currency?: string }) {
  const combined = useMemo(() => {
    const values = new Map<string, Record<string, string | number>>();
    for (const [name, series] of [[trend?.label ?? title, trend], [secondary?.label ?? "Payment risk", secondary]] as const) {
      series?.points.forEach((point) => values.set(String(point.date), { ...(values.get(String(point.date)) ?? { date: String(point.date) }), [name]: Number(point.value) || 0 }));
    }
    return [...values.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [trend, secondary, title]);
  const seriesNames = [...new Set(combined.flatMap((item) => Object.keys(item).filter((key) => key !== "date")))];
  return <Card className="p-5 shadow-sm"><div className="mb-1 flex items-start justify-between gap-3"><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><span className="rounded-lg bg-slate-100 p-2 text-slate-600"><TrendingUp className="size-4" /></span></div><div className="mt-5 h-72">{combined.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={combined} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><defs><linearGradient id={`fill-${title.replaceAll(" ", "-")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.26} /><stop offset="95%" stopColor={color} stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" /><XAxis dataKey="date" tickFormatter={formatTick} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} /><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={58} tickFormatter={(value) => currency ? compactAxis(value, currency) : numberFormat(Number(value))} /><Tooltip labelFormatter={(value) => dateLabel(String(value))} formatter={(value, name) => [currency ? currencyFormat(Number(value), currency) : numberFormat(Number(value)), name]} contentStyle={{ borderRadius: 12, borderColor: "var(--color-border)", background: "var(--color-card)" }} /><Legend />{seriesNames.map((name, index) => <Area key={name} type="monotone" dataKey={name} name={name} stroke={index === 0 ? color : "#f43f5e"} fill={index === 0 ? `url(#fill-${title.replaceAll(" ", "-")})` : "#f43f5e"} fillOpacity={index === 0 ? 1 : 0.08} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />)}</AreaChart></ResponsiveContainer> : <ChartEmpty loading={loading} message="Trend data is not available for this reporting period." />}</div></Card>;
}
function formatTick(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function dateLabel(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
function compactAxis(value: number, currency: string) { return `${currency} ${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 }).format(Number(value))}`; }
function ChartEmpty({ loading, message }: { loading: boolean; message: string }) { return <div className="grid h-full place-items-center rounded-xl border border-dashed bg-muted/20 px-6 text-center text-sm text-muted-foreground">{loading ? "Loading chart…" : message}</div>; }
function WatchCard({ title, metric, icon, tone, loading, detail }: { title: string; metric?: DecisionKpi | DashboardSection["kpis"][number]; icon: React.ReactNode; tone: "amber" | "rose" | "blue"; loading: boolean; detail?: string }) {
  const tint = tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" : tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-blue-700";
  return <Card className="flex items-center justify-between gap-4 border p-5 transition-all duration-200 group-hover:border-blue-600 group-hover:bg-blue-600 group-hover:bg-none group-hover:text-white group-hover:shadow-lg"><div><p className="text-sm font-medium text-muted-foreground group-hover:text-blue-50">{title}</p><p className="mt-2 text-3xl font-bold tabular-nums">{loading && !metric ? "…" : formatRaw(metric?.value)}</p>{detail && <p className="mt-1 text-xs text-muted-foreground group-hover:text-blue-50">{detail}</p>}</div><span className={`rounded-xl border p-3 transition-colors group-hover:border-white group-hover:bg-white group-hover:text-blue-700 ${tint}`}>{icon}</span></Card>;
}
