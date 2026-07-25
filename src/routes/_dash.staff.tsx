import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { staff } from "@/lib/mock-data";
import { Plus } from "lucide-react";
import { StatusBadge } from "./_dash.dashboard";

export const Route = createFileRoute("/_dash/staff")({ component: StaffPage });

function StaffPage() {
  return (
    <div>
      <PageHeader title="Staff & Roles" description="Manage internal users and RBAC permissions." actions={<Button><Plus className="h-4 w-4 mr-2" />Invite staff</Button>} />
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead>
            <TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.id}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell><Badge variant="secondary">{s.role}</Badge></TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm">Manage</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
