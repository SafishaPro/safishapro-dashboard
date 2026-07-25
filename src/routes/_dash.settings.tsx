import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { services } from "@/lib/mock-data";

export const Route = createFileRoute("/_dash/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <div>
      <PageHeader title="System Configuration" description="Service categories, pricing and global platform settings." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-semibold mb-4">Service catalog</h3>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Service</TableHead><TableHead>Duration</TableHead>
              <TableHead className="text-right">Base price (KES)</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.duration}</TableCell>
                  <TableCell className="text-right">{s.basePrice.toLocaleString()}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm">Edit</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Platform settings</h3>
          <div className="space-y-2"><Label>Platform commission (%)</Label><Input defaultValue="18" /></div>
          <div className="space-y-2"><Label>Default currency</Label><Input defaultValue="KES" /></div>
          <div className="flex items-center justify-between"><Label>Enable M-Pesa payments</Label><Switch defaultChecked /></div>
          <div className="flex items-center justify-between"><Label>Auto-assign cleaners</Label><Switch /></div>
          <Button className="w-full">Save changes</Button>
        </Card>
      </div>
    </div>
  );
}
