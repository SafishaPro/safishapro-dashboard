import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { customers } from "@/lib/mock-data";
import { Plus, Download } from "lucide-react";

export const Route = createFileRoute("/_dash/customers")({ component: CustomersPage });

function CustomersPage() {
  return (
    <div>
      <PageHeader
        title="Customers"
        description="View customer profiles, addresses and booking history."
        actions={<><Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button><Button><Plus className="h-4 w-4 mr-2" />New customer</Button></>}
      />
      <Card className="p-4">
        <div className="mb-4"><Input placeholder="Search customers…" className="max-w-sm" /></div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead>
              <TableHead>Phone</TableHead><TableHead>Address</TableHead><TableHead className="text-right">Bookings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.address}</TableCell>
                <TableCell className="text-right">{c.bookings}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
