import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { cleanerSchedule } from "@/lib/mock-data";
import { MapPin, Clock } from "lucide-react";

export const Route = createFileRoute("/_dash/portal/cleaner/schedule")({ component: SchedulePage });

function SchedulePage() {
  return (
    <div>
      <PageHeader title="My Schedule" description="Upcoming jobs assigned to you." />
      <div className="grid gap-3">
        {cleanerSchedule.map((j) => (
          <Card key={j.id} className="p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-xs text-muted-foreground">{j.id}</div>
              <div className="font-semibold text-lg">{j.service}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{j.date}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{j.address}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Payout</div>
              <div className="text-lg font-semibold">KES {j.pay.toLocaleString()}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
