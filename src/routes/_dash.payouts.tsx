import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { payouts } from "@/lib/mock-data";
import { StatusBadge } from "./_dash.dashboard";

export const Route = createFileRoute("/_dash/payouts")({ component: PayoutsPage });

function PayoutsPage() {
  return (
    <div>
      <PageHeader title="Cleaner Payouts" description="Pending and completed payouts to cleaners." actions={<Button>Run payout batch</Button>} />
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>ID</TableHead><TableHead>Cleaner</TableHead><TableHead>Period</TableHead>
            <TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {payouts.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell className="font-medium">{p.cleaner}</TableCell>
                <TableCell>{p.period}</TableCell>
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
