import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, RefreshCw, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { analyticsApi, servicesApi, type DecisionKpi, type DecisionPoint, type DecisionSection, type DecisionSummary } from "@/lib/api";

export const Route = createFileRoute("/_dash/analytics")({ component: AnalyticsPage });

const chartColors = ["#123b74", "#2563eb", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444"];
const today = new Date();
const dateValue = (date: Date) => date.toISOString().slice(0, 10);
const initialStart = dateValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29));
const initialEnd = dateValue(today);

const readable = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const numeric = (value: unknown) => typeof value === "number" ? value : Number(value ?? 0) || 0;
const formatValue = (value: unknown) => typeof value === "number" ? value.toLocaleString() : value == null ? "—" : String(value);

function AnalyticsPage() {
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
  const [usage, setUsage] = useState<{ total_bookings: number; total_active_subscriptions: number; services: Array<{ service_name: string; bookings: number; completed_bookings: number; active_subscriptions: number; quoted_value: string | number; currency: string }> } | null>(null);
  const [decision, setDecision] = useState<DecisionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartModes, setChartModes] = useState<Record<string, "bar" | "line" | "pie">>({ demand: "line", completion: "line", subscriptions: "line", quoted: "line" });

  const load = async () => {
    if (!startDate || !endDate || startDate > endDate) {
      setError("Choose a valid start and end date.");
      return;
    }
    setLoading(true);
    setError(null);
    const [usageResult, decisionResult] = await Promise.allSettled([
      servicesApi.usage(startDate, endDate),
      analyticsApi.decisionSummary({ start_date: startDate, end_date: endDate, granularity }),
    ]);
    if (usageResult.status === "fulfilled") setUsage(usageResult.value);
    if (decisionResult.status === "fulfilled") setDecision(decisionResult.value);
    const issues = [usageResult, decisionResult].filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => result.reason instanceof Error ? result.reason.message : "Unable to load analytics.");
    if (issues.length) setError(issues.join(" "));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const serviceData = useMemo(() => usage?.services.slice().sort((a, b) => b.bookings - a.bookings) ?? [], [usage]);
  const completionData = useMemo(() => serviceData.map((service) => {
    const completion = service.bookings ? Math.round((service.completed_bookings / service.bookings) * 100) : 0;
    return { name: service.service_name, complete: completion, incomplete: 100 - completion };
  }), [serviceData]);
  const subscriptionData = useMemo(() => serviceData.map((service) => ({ name: service.service_name, subscriptions: service.active_subscriptions })), [serviceData]);
  const quotedByCurrency = useMemo(() => Object.entries(serviceData.reduce<Record<string, number>>((totals, service) => {
    totals[service.currency] = (totals[service.currency] ?? 0) + numeric(service.quoted_value);
    return totals;
  }, {})).map(([currency, quoted]) => ({ currency, quoted })), [serviceData]);
  const kpis = useMemo(() => ["bookings", "payments", "finance", "operations"].flatMap((name) => normaliseKpis(decision?.[name] as DecisionSection | undefined, readable(name))), [decision]);

  return <div className="space-y-6">
    <PageHeader
      title="Analytics"
      description="Decision-ready booking, payment, finance, service, and operational performance."
      actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />Refresh data</Button>}
    />

    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5"><Label htmlFor="analytics-start">Start date</Label><Input id="analytics-start" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="analytics-end">End date</Label><Input id="analytics-end" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="analytics-granularity">Granularity</Label><select id="analytics-granularity" value={granularity} onChange={(event) => setGranularity(event.target.value as typeof granularity)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
        <Button onClick={() => void load()} disabled={loading}><CalendarDays className="mr-2 size-4" />Apply period</Button>
        {decision?.comparison_start_date && <p className="pb-2 text-sm text-muted-foreground">Compared with {decision.comparison_start_date} to {decision.comparison_end_date}</p>}
      </div>
    </Card>

    {error && <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</Card>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Bookings" value={usage?.total_bookings ?? 0} icon={<BarChart3 className="size-5" />} colour="blue" />
      <MetricCard title="Active subscriptions" value={usage?.total_active_subscriptions ?? 0} icon={<TrendingUp className="size-5" />} colour="teal" />
      {kpis.slice(0, 6).map((kpi) => <DecisionCard key={`${kpi.section}-${kpi.label}`} kpi={kpi} />)}
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Service demand" subtitle="Bookings by service, highest first" controls={<ChartModes value={chartModes.demand} onChange={(mode) => setChartModes({ ...chartModes, demand: mode })} />}>
        <DataChart mode={chartModes.demand} data={serviceData} nameKey="service_name" valueKey="bookings" valueLabel="Bookings" />
      </ChartCard>
      <ChartCard title="Completion rate" subtitle="Completed versus incomplete bookings" controls={<ChartModes value={chartModes.completion} onChange={(mode) => setChartModes({ ...chartModes, completion: mode })} />}>
        {chartModes.completion === "pie" ? <CompletionPie data={serviceData} /> : chartModes.completion === "line" ? <ResponsiveContainer width="100%" height="100%"><LineChart data={completionData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value) => `${value}%`} /><Legend /><Line type="monotone" dataKey="complete" name="Completed" stroke="#14b8a6" strokeWidth={2.5} /></LineChart></ResponsiveContainer> : <ResponsiveContainer width="100%" height="100%"><BarChart data={completionData} layout="vertical" margin={{ left: 16 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} /><Tooltip formatter={(value) => `${value}%`} /><Legend /><Bar dataKey="complete" name="Completed" stackId="rate" fill="#14b8a6" /><Bar dataKey="incomplete" name="Incomplete" stackId="rate" fill="#e2e8f0" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>}
      </ChartCard>
      <ChartCard title="Subscription adoption" subtitle="Active recurring plans by service" controls={<ChartModes value={chartModes.subscriptions} onChange={(mode) => setChartModes({ ...chartModes, subscriptions: mode })} />}>
        <DataChart mode={chartModes.subscriptions} data={subscriptionData} nameKey="name" valueKey="subscriptions" valueLabel="Active subscriptions" />
      </ChartCard>
      <ChartCard title="Quoted value" subtitle="Amounts are deliberately kept separate by currency" controls={<ChartModes value={chartModes.quoted} onChange={(mode) => setChartModes({ ...chartModes, quoted: mode })} />}>
        <DataChart mode={chartModes.quoted} data={quotedByCurrency} nameKey="currency" valueKey="quoted" valueLabel="Quoted value" />
      </ChartCard>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      {(["bookings", "payments", "finance", "operations"] as const).map((sectionName) => <DecisionSectionCard key={sectionName} title={readable(sectionName)} section={decision?.[sectionName] as DecisionSection | undefined} />)}
    </section>
  </div>;
}

function MetricCard({ title, value, icon, colour }: { title: string; value: string | number; icon: React.ReactNode; colour: "blue" | "teal" }) {
  const styles = colour === "blue" ? "border-blue-100 bg-blue-50 text-blue-950" : "border-teal-100 bg-teal-50 text-teal-950";
  return <Card className={`border p-4 ${styles}`}><div className="flex items-start justify-between"><div><p className="text-sm font-medium opacity-70">{title}</p><p className="mt-2 text-3xl font-bold">{formatValue(value)}</p></div><div className="rounded-lg bg-white/70 p-2">{icon}</div></div></Card>;
}

type NormalKpi = { section: string; label: string; value: unknown; delta: number | null; direction: string | null };
function normaliseKpis(section: DecisionSection | undefined, sectionName: string): NormalKpi[] {
  if (!section?.kpis) return [];
  const source = Array.isArray(section.kpis) ? section.kpis : Object.entries(section.kpis).map(([key, value]) => typeof value === "object" && value !== null ? { key, ...(value as DecisionKpi) } : { key, value });
  return source.map((item) => ({ section: sectionName, label: item.label ?? readable(String(item.key ?? "Metric")), value: item.value, delta: item.delta_percentage ?? null, direction: item.direction ?? null }));
}

function DecisionCard({ kpi }: { kpi: NormalKpi }) {
  const positive = kpi.direction === "up";
  const negative = kpi.direction === "down";
  return <Card className="p-4"><p className="text-sm text-muted-foreground">{kpi.label}</p><p className="mt-2 text-2xl font-bold">{formatValue(kpi.value)}</p>{kpi.delta !== null && <div className={`mt-2 flex items-center gap-1 text-xs ${positive ? "text-emerald-600" : negative ? "text-rose-600" : "text-muted-foreground"}`}>{positive ? <ArrowUpRight className="size-3.5" /> : negative ? <ArrowDownRight className="size-3.5" /> : null}{Math.abs(kpi.delta).toFixed(1)}% vs prior period</div>}</Card>;
}

function ChartCard({ title, subtitle, children, controls }: { title: string; subtitle: string; children: React.ReactNode; controls?: React.ReactNode }) {
  return <Card className="p-5"><div className="mb-1 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2>{controls}</div><p className="mb-4 text-sm text-muted-foreground">{subtitle}</p><div className="h-72">{children}</div></Card>;
}

function ChartModes({ value, onChange }: { value: "bar" | "line" | "pie"; onChange: (mode: "bar" | "line" | "pie") => void }) {
  return <div className="flex rounded-md border p-0.5">{(["line", "bar", "pie"] as const).map((mode) => <button key={mode} type="button" onClick={() => onChange(mode)} className={`rounded px-2 py-1 text-xs font-medium ${value === mode ? "bg-blue-950 text-white" : "text-muted-foreground hover:bg-muted"}`}>{readable(mode)}</button>)}</div>;
}

function DataChart({ mode, data, nameKey, valueKey, valueLabel }: { mode: "bar" | "line" | "pie"; data: Array<Record<string, unknown>>; nameKey: string; valueKey: string; valueLabel: string }) {
  if (mode === "pie") return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={56} outerRadius={96} paddingAngle={2}>{data.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>;
  if (mode === "line") return <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={nameKey} tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey={valueKey} name={valueLabel} stroke="#123b74" strokeWidth={2.5} /></LineChart></ResponsiveContainer>;
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={nameKey} tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey={valueKey} name={valueLabel} fill="#123b74" radius={[4, 4, 0, 0]}>{data.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer>;
}

function CompletionPie({ data }: { data: Array<{ bookings: number; completed_bookings: number }> }) {
  const totals = data.reduce((result, service) => ({ completed: result.completed + service.completed_bookings, incomplete: result.incomplete + Math.max(0, service.bookings - service.completed_bookings) }), { completed: 0, incomplete: 0 });
  const pieData = [{ name: "Completed", value: totals.completed }, { name: "Incomplete", value: totals.incomplete }];
  return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={96} paddingAngle={2}>{pieData.map((_, index) => <Cell key={index} fill={index === 0 ? "#14b8a6" : "#e2e8f0"} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>;
}

function DecisionSectionCard({ title, section }: { title: string; section: DecisionSection | undefined }) {
  const series = normaliseSeries(section?.series);
  const breakdowns = normaliseBreakdowns(section?.breakdowns);
  return <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">{title} decisions</h2><p className="text-sm text-muted-foreground">Performance over the selected period</p></div>{section ? <Badge variant="secondary">Live data</Badge> : <Badge variant="outline">No data</Badge>}</div>{series.length ? <div className="h-60"><ResponsiveContainer width="100%" height="100%"><LineChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 12 }} /><YAxis /><Tooltip /><Legend />{Object.keys(series[0] ?? {}).filter((key) => key !== "date").map((key, index) => <Line key={key} type="monotone" dataKey={key} stroke={chartColors[index % chartColors.length]} strokeWidth={2} dot={false} />)}</LineChart></ResponsiveContainer></div> : <p className="py-8 text-sm text-muted-foreground">No time-series data is available for this period.</p>}{breakdowns.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{breakdowns.slice(0, 8).map((item) => <Badge key={item.label} variant="secondary">{item.label}: {formatValue(item.value)}</Badge>)}</div>}</Card>;
}

function normaliseSeries(series: DecisionSection["series"] | undefined): Array<Record<string, string | number>> {
  if (!series) return [];
  const entries = Array.isArray(series) ? series.map((item) => [item.label ?? item.key ?? "Value", item.points ?? []] as const) : Object.entries(series);
  const rows = new Map<string, Record<string, string | number>>();
  entries.forEach(([label, points]) => (points as DecisionPoint[]).forEach((point) => rows.set(point.date, { ...(rows.get(point.date) ?? { date: point.date }), [String(label)]: numeric(point.value) })));
  return [...rows.values()];
}

function normaliseBreakdowns(breakdowns: DecisionSection["breakdowns"] | undefined): Array<{ label: string; value: unknown }> {
  if (!breakdowns) return [];
  if (Array.isArray(breakdowns)) return breakdowns.map((item, index) => ({ label: String(item.label ?? item.name ?? item.key ?? `Item ${index + 1}`), value: item.value ?? item.count ?? item.total ?? "—" }));
  return Object.entries(breakdowns).map(([label, value]) => ({ label: readable(label), value: typeof value === "object" && value !== null ? (value as Record<string, unknown>).value ?? (value as Record<string, unknown>).count ?? "—" : value }));
}
