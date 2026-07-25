import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { kpis, bookingsOverTime, bookings, tickets } from "@/lib/mock-data";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_dash/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Live snapshot of platform activity and KPIs." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="text-sm text-muted-foreground">{k.label}</div>
            <div className="mt-2 flex items-end justify-between">
              <div className="text-3xl font-semibold tracking-tight">{k.value}</div>
              <div className={`text-xs flex items-center gap-1 ${k.tone === "up" ? "text-emerald-600" : "text-destructive"}`}>
                {k.tone === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {k.delta}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-semibold">Bookings over time</h3>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bookingsOverTime}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="bookings" stroke="var(--color-chart-1)" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-semibold">Revenue</h3>
            <span className="text-xs text-muted-foreground">KES</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="revenue" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Recent bookings</h3>
          <div className="space-y-3">
            {bookings.slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{b.id} · {b.service}</div>
                  <div className="text-xs text-muted-foreground">{b.customer} · {b.date}</div>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Open support tickets</h3>
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{t.subject}</div>
                  <div className="text-xs text-muted-foreground">{t.customer} · {t.updated}</div>
                </div>
                <Badge variant={t.priority === "High" ? "destructive" : "secondary"}>{t.priority}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    "In Progress": "bg-sky-100 text-sky-700 border-sky-200",
    Pending: "bg-amber-100 text-amber-700 border-amber-200",
    Cancelled: "bg-rose-100 text-rose-700 border-rose-200",
    Paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Failed: "bg-rose-100 text-rose-700 border-rose-200",
    Verified: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>{status}</span>;
}
