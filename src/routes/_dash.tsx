import { createFileRoute, Outlet, Navigate, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { canVisit, navFor } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bell, Search, Sparkles, LogOut } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/_dash")({
  component: DashLayout,
});

function DashLayout() {
  const { user, permissions, logout, isRestoring } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = useMemo(() => (user ? navFor(permissions) : []), [user, permissions]);
  const sections = useMemo(() => {
    const map = new Map<string, typeof items>();
    items.forEach((i) => {
      if (!map.has(i.section)) map.set(i.section, [] as any);
      map.get(i.section)!.push(i);
    });
    return Array.from(map.entries());
  }, [items]);

  if (isRestoring) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!canVisit(pathname, permissions)) return <Navigate to="/dashboard" replace />;

  const initials = user.full_name.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden h-screen shrink-0 md:flex md:w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="h-16 px-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary grid place-items-center">
            <Sparkles className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">SafishaPro</span>
        </div>
        <nav className="sidebar-nav flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {sections.map(([section, list]) => (
            <div key={section}>
              <div className="px-2 mb-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/50">{section}</div>
              <ul className="space-y-1">
                {list.map((i) => {
                  const active = pathname === i.to;
                  const Icon = i.icon;
                  return (
                    <li key={i.to}>
                      <Link
                        to={i.to}
                        className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors ${
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {i.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/60">
          v1.0 · Demo mock data
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="h-16 border-b bg-card flex items-center gap-4 px-4 md:px-6">
          <div className="flex-1 flex items-center gap-3 max-w-xl">
            <div className="relative w-full">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search bookings, customers, cleaners…" className="pl-9 bg-muted/50 border-transparent" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full">
                  <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback></Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{user.full_name}</div>
                  <div className="text-xs text-muted-foreground font-normal">{user.email}</div>
                  <Badge variant="secondary" className="mt-2">{user.role.name}</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await logout(); navigate({ to: "/login" }); }}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
