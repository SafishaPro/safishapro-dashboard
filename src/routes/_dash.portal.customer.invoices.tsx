import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { customerBookings } from "@/lib/mock-data";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_dash/portal/customer/invoices")({ component: InvoicesPage });

function InvoicesPage() {
  return (
    <div>
      <PageHeader title="Invoices" description="Downloadable receipts for your bookings." />
      <div className="grid gap-3">
        {customerBookings.map((b) => (
          <Card key={b.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">INV-{b.id.replace("BK-", "")}</div>
              <div className="text-xs text-muted-foreground">{b.service} · {b.date}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="font-semibold">KES {b.amount.toLocaleString()}</div>
              </div>
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />PDF</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
