import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { cleanerEarnings } from "@/lib/mock-data";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Star } from "lucide-react";

export const Route = createFileRoute("/_dash/portal/cleaner/earnings")({ component: EarningsPage });

function EarningsPage() {
  const total = cleanerEarnings.reduce((s, e) => s + e.earnings, 0);
  const avg = (cleanerEarnings.reduce((s, e) => s + e.rating, 0) / cleanerEarnings.length).toFixed(2);
  return (
    <div>
      <PageHeader title="Earnings & Ratings" description="Your weekly earnings and average rating." />
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <Card className="p-5"><div className="text-sm text-muted-foreground">Total earnings</div><div className="text-2xl font-semibold mt-1">KES {total.toLocaleString()}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Avg rating</div><div className="text-2xl font-semibold mt-1 flex items-center gap-1"><Star className="h-5 w-5 fill-amber-400 text-amber-400" />{avg}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Jobs completed</div><div className="text-2xl font-semibold mt-1">{cleanerEarnings.reduce((s, e) => s + e.jobs, 0)}</div></Card>
      </div>
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Earnings by week</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cleanerEarnings}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="period" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="earnings" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
