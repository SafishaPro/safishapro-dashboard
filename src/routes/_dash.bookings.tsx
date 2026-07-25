import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bookings } from "@/lib/mock-data";
import { StatusBadge } from "./_dash.dashboard";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_dash/bookings")({ component: BookingsPage });

function BookingsPage() {
  const filters = ["All", "Pending", "In Progress", "Completed", "Cancelled"] as const;
  return (
    <div>
      <PageHeader title="Bookings" description="All bookings across the platform." actions={<Button><Plus className="h-4 w-4 mr-2" />New booking</Button>} />
      <Tabs defaultValue="All">
        <TabsList>
          {filters.map((f) => <TabsTrigger key={f} value={f}>{f}</TabsTrigger>)}
        </TabsList>
        {filters.map((f) => (
          <TabsContent key={f} value={f} className="mt-4">
            <Card className="p-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ID</TableHead><TableHead>Customer</TableHead><TableHead>Cleaner</TableHead>
                  <TableHead>Service</TableHead><TableHead>Date</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Amount (KES)</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {bookings.filter((b) => f === "All" ? true : b.status === f).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.id}</TableCell>
                      <TableCell className="font-medium">{b.customer}</TableCell>
                      <TableCell>{b.cleaner}</TableCell>
                      <TableCell>{b.service}</TableCell>
                      <TableCell>{b.date}</TableCell>
                      <TableCell><StatusBadge status={b.status} /></TableCell>
                      <TableCell className="text-right">{b.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
