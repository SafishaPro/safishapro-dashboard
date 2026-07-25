import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notifications } from "@/lib/mock-data";

export const Route = createFileRoute("/_dash/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  return (
    <div>
      <PageHeader title="Notifications Hub" description="System alerts, SMS and email logs." />
      <Card className="divide-y p-0">
        {notifications.map((n) => (
          <div key={n.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary">{n.type}</Badge>
                <span className="text-xs text-muted-foreground">via {n.channel}</span>
              </div>
              <div className="font-medium">{n.message}</div>
              <div className="text-xs text-muted-foreground">to {n.to}</div>
            </div>
            <div className="text-xs text-muted-foreground">{n.date}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}
