import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { payments } from "@/lib/mock-data";
import { StatusBadge } from "./_dash.dashboard";

export const Route = createFileRoute("/_dash/payments")({ component: PaymentsPage });

function PaymentsPage() {
  const total = payments.filter(p => p.status === "Paid").reduce((s, p) => s + p.amount, 0);
  return (
    <div>
      <PageHeader title="Customer Payments" description="Incoming payments, invoices and M-Pesa transaction logs." />
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <Card className="p-5"><div className="text-sm text-muted-foreground">Collected</div><div className="text-2xl font-semibold mt-1">KES {total.toLocaleString()}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Pending</div><div className="text-2xl font-semibold mt-1">KES 2,800</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Failed</div><div className="text-2xl font-semibold mt-1">KES 12,500</div></Card>
      </div>
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>ID</TableHead><TableHead>Booking</TableHead><TableHead>Customer</TableHead>
            <TableHead>Method</TableHead><TableHead>Ref</TableHead><TableHead>Date</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell className="font-mono text-xs">{p.booking}</TableCell>
                <TableCell className="font-medium">{p.customer}</TableCell>
                <TableCell>{p.method}</TableCell>
                <TableCell className="font-mono text-xs">{p.ref}</TableCell>
                <TableCell>{p.date}</TableCell>
                <TableCell><StatusBadge status={p.status} /></TableCell>
                <TableCell className="text-right">KES {p.amount.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
