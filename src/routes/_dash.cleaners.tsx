import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cleaners } from "@/lib/mock-data";
import { Star, Plus } from "lucide-react";
import { StatusBadge } from "./_dash.dashboard";

export const Route = createFileRoute("/_dash/cleaners")({ component: CleanersPage });

function CleanersPage() {
  return (
    <div>
      <PageHeader title="Cleaner Profiles" description="Onboarding status, verification and ratings." actions={<Button><Plus className="h-4 w-4 mr-2" />Onboard cleaner</Button>} />
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Zone</TableHead>
            <TableHead>Rating</TableHead><TableHead className="text-right">Jobs</TableHead>
            <TableHead>Verification</TableHead><TableHead>Availability</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {cleaners.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.zone}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{c.rating}</span></TableCell>
                <TableCell className="text-right">{c.jobs}</TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell><StatusBadge status={c.availability} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
