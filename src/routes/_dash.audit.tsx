import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { auditLogs } from "@/lib/mock-data";

export const Route = createFileRoute("/_dash/audit")({ component: AuditPage });

function AuditPage() {
  return (
    <div>
      <PageHeader title="Audit Logs" description="Immutable record of privileged actions." />
      <Card className="p-0 divide-y">
        {auditLogs.map((l) => (
          <div key={l.id} className="p-4 flex items-center justify-between text-sm">
            <div>
              <div className="font-medium">{l.action}</div>
              <div className="text-xs text-muted-foreground">by {l.actor}</div>
            </div>
            <div className="text-xs text-muted-foreground">{l.date}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}
