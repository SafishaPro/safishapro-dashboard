import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bookings } from "@/lib/mock-data";
import { StatusBadge } from "./_dash.dashboard";

export const Route = createFileRoute("/_dash/portal/cleaner/jobs")({ component: JobsPage });

function JobsPage() {
  return (
    <div>
      <PageHeader title="Job History" description="Every job you've completed." />
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Booking</TableHead><TableHead>Customer</TableHead><TableHead>Service</TableHead>
            <TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Payout</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.id}</TableCell>
                <TableCell>{b.customer}</TableCell>
                <TableCell>{b.service}</TableCell>
                <TableCell>{b.date}</TableCell>
                <TableCell><StatusBadge status={b.status} /></TableCell>
                <TableCell className="text-right">KES {Math.round(b.amount * 0.7).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
