import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tickets } from "@/lib/mock-data";

export const Route = createFileRoute("/_dash/tickets")({ component: TicketsPage });

function TicketsPage() {
  return (
    <div>
      <PageHeader title="Support Tickets" description="Customer and cleaner inquiries." actions={<Button>New ticket</Button>} />
      <div className="grid gap-3">
        {tickets.map((t) => (
          <Card key={t.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
                <Badge variant={t.priority === "High" ? "destructive" : "secondary"}>{t.priority}</Badge>
                <Badge variant="outline">{t.status}</Badge>
              </div>
              <div className="font-medium mt-1">{t.subject}</div>
              <div className="text-xs text-muted-foreground">{t.customer} · updated {t.updated}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Refund</Button>
              <Button size="sm">Reply</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
