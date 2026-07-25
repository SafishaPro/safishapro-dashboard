import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { cleaners, bookings } from "@/lib/mock-data";

export const Route = createFileRoute("/_dash/dispatch")({ component: DispatchPage });

const hours = Array.from({ length: 10 }, (_, i) => 8 + i);

function DispatchPage() {
  return (
    <div>
      <PageHeader title="Dispatch Calendar" description="Assign cleaners to jobs — drag-and-drop friendly grid." />
      <Card className="p-0 overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid" style={{ gridTemplateColumns: `180px repeat(${hours.length}, minmax(80px, 1fr))` }}>
            <div className="p-3 text-xs uppercase text-muted-foreground border-b">Cleaner</div>
            {hours.map((h) => <div key={h} className="p-3 text-xs uppercase text-muted-foreground border-b border-l text-center">{h}:00</div>)}
            {cleaners.map((c) => (
              <>
                <div key={c.id} className="p-3 border-b font-medium text-sm">{c.name}</div>
                {hours.map((h) => {
                  const job = bookings.find((b) => b.cleaner === c.name && parseInt(b.date.split(" ")[1]) === h);
                  return (
                    <div key={c.id + h} className="border-b border-l h-16 p-1 relative">
                      {job && (
                        <div className="absolute inset-1 rounded-md bg-primary/10 border border-primary/30 p-2 text-xs">
                          <div className="font-medium text-primary truncate">{job.service}</div>
                          <div className="text-muted-foreground truncate">{job.customer}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
