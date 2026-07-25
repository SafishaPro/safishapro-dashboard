import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { customerBookings } from "@/lib/mock-data";
import { StatusBadge } from "./_dash.dashboard";

export const Route = createFileRoute("/_dash/portal/customer/bookings")({ component: CustBookingsPage });

function CustBookingsPage() {
  return (
    <div>
      <PageHeader title="My Bookings" description="Current and past bookings." actions={<Button>Book a cleaner</Button>} />
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Booking</TableHead><TableHead>Service</TableHead><TableHead>Cleaner</TableHead>
            <TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {customerBookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.id}</TableCell>
                <TableCell className="font-medium">{b.service}</TableCell>
                <TableCell>{b.cleaner}</TableCell>
                <TableCell>{b.date}</TableCell>
                <TableCell><StatusBadge status={b.status} /></TableCell>
                <TableCell className="text-right">KES {b.amount.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
