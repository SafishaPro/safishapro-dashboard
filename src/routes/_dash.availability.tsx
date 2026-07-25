import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { cleaners } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_dash/availability")({ component: AvailabilityPage });

const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function AvailabilityPage() {
  return (
    <div>
      <PageHeader title="Availability & Zones" description="Weekly availability grid per cleaner and coverage zones." />
      <Card className="p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-4">Cleaner</th>
              <th className="pr-4">Zone</th>
              {days.map((d) => <th key={d} className="px-2 text-center">{d}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {cleaners.map((c) => (
              <tr key={c.id}>
                <td className="py-3 pr-4 font-medium">{c.name}</td>
                <td className="pr-4"><Badge variant="secondary">{c.zone}</Badge></td>
                {days.map((d, i) => {
                  const on = (c.id.charCodeAt(3) + i) % 3 !== 0;
                  return <td key={d} className="px-2 text-center">
                    <span className={`inline-block h-6 w-10 rounded ${on ? "bg-primary/20 border border-primary/40" : "bg-muted"}`} />
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
