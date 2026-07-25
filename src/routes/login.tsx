import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — SafishaPro" }, { name: "description", content: "Sign in to SafishaPro admin dashboard." }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@safisha.pro");
  const [password, setPassword] = useState("demo1234");

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary grid place-items-center">
            <Sparkles className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          SafishaPro
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight">Operations, cleaners, and payments — in one place.</h1>
          <p className="text-sidebar-foreground/70 max-w-md">The internal control center for dispatchers, finance, support and admins running SafishaPro.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">© SafishaPro 2026</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Use any email + password (demo). Role is switchable after login.</p>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              login(email, password);
              navigate({ to: "/dashboard" });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email or Username</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full">Sign in</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
