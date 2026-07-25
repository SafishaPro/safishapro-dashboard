import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_dash/portal/customer/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="Profile & Addresses" description="Manage your account and saved addresses." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Account</h3>
          <div className="space-y-2"><Label>Name</Label><Input defaultValue={user?.name} /></div>
          <div className="space-y-2"><Label>Email</Label><Input defaultValue={user?.email} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input defaultValue="+254 700 123 456" /></div>
          <Button>Save</Button>
        </Card>
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Saved addresses</h3>
          {["Home — Kilimani, Nairobi", "Office — Westlands, Nairobi"].map((a) => (
            <div key={a} className="p-3 border rounded-md flex justify-between items-center">
              <span className="text-sm">{a}</span>
              <Button variant="ghost" size="sm">Edit</Button>
            </div>
          ))}
          <Button variant="outline" className="w-full">+ Add address</Button>
        </Card>
      </div>
    </div>
  );
}
