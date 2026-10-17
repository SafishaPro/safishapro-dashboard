import { createFileRoute, Outlet, Navigate, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { canVisit, navFor } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bell, Search, Sparkles, LogOut, Menu, ChevronRight, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usersApi } from "@/lib/api";

export const Route = createFileRoute("/_dash")({
  component: DashLayout,
});

function DashLayout() {
  const { user, permissions, logout, isRestoring } = useAuth();
  const [accountPhotoUrl, setAccountPhotoUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = useMemo(() => (user ? navFor(permissions, user.role.slug) : []), [user, permissions]);
  const sections = useMemo(() => {
    const map = new Map<string, typeof items>();
    items.forEach((i) => {
      if (!map.has(i.section)) map.set(i.section, [] as any);
      map.get(i.section)!.push(i);
    });
    return Array.from(map.entries());
  }, [items]);

  useEffect(() => {
    let active = true;
    setAccountPhotoUrl(null);
    if (!user) return () => { active = false; };
    void usersApi.myProfilePhotoUrl()
      .then(({ url }) => { if (active) setAccountPhotoUrl(url); })
      .catch(() => { if (active) setAccountPhotoUrl(null); });
    return () => { active = false; };
  }, [user?.id, user?.profile_photo_url]);

  if (isRestoring) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!canVisit(pathname, permissions, user.role.slug)) return <Navigate to={items[0]?.to ?? "/profile"} replace />;

  const initials = user.full_name.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden h-screen w-[17rem] shrink-0 flex-col border-r border-blue-950/30 bg-gradient-to-b from-[#123b74] via-[#10366b] to-[#0c2d5d] text-white md:flex">
        <div className="flex h-[4.5rem] items-center gap-3 border-b border-white/10 px-5">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 shadow-md shadow-blue-950/30 ring-1 ring-white/20">
            <Sparkles className="size-5 text-white" />
          </div>
          <div className="min-w-0"><div className="truncate text-sm font-bold tracking-wide text-white">CLEAN MATCH</div><div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-50/90">Operations console</div></div>
        </div>
        <nav aria-label="Main navigation" className="sidebar-nav flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {sections.map(([section, list]) => (
            <div key={section}>
              <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-50/85">{section}</div>
              <ul className="space-y-1">
                {list.map((i) => {
                  const active = pathname === i.to || pathname.startsWith(`${i.to}/`);
                  const Icon = i.icon;
                  return (
                    <li key={i.to}>
                      <Link
                        to={i.to}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                          active
                            ? "bg-blue-500 font-semibold text-white shadow-md shadow-blue-950/25 ring-1 ring-blue-300/30 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-sky-200"
                            : "text-white/95 hover:bg-white/15 hover:text-white"
                        }`}
                      >
                        <Icon className={`size-[17px] shrink-0 ${active ? "text-white" : "text-blue-50/90 group-hover:text-white"}`} />
                        {i.label}
                        {active && <ChevronRight className="ml-auto size-4 text-white" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] p-3"><span className="grid size-8 place-items-center rounded-lg bg-sky-300/15 text-sky-100"><ShieldCheck className="size-4" /></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">Secure workspace</p><p className="mt-0.5 truncate text-[10px] text-blue-50/80">Role-based access enabled</p></div></div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="h-16 border-b bg-card flex items-center gap-4 px-4 md:px-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2 border-blue-200 bg-blue-700 text-white hover:bg-blue-800 hover:text-white md:hidden"><Menu className="size-4" /><span>Menu</span></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[75vh] w-72 overflow-y-auto p-2">
              {sections.map(([section, list], index) => <div key={section}>
                {index > 0 && <DropdownMenuSeparator className="my-2" />}
                <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{section}</DropdownMenuLabel>
                {list.map((item) => { const Icon = item.icon; const active = pathname === item.to || pathname.startsWith(`${item.to}/`); return <DropdownMenuItem key={item.to} asChild className={active ? "bg-blue-50 font-semibold text-blue-700" : ""}><Link to={item.to}><Icon className="mr-2 size-4" />{item.label}</Link></DropdownMenuItem>; })}
              </div>)}
            </DropdownMenuContent>
          </DropdownMenu>
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
                  <Avatar className="h-9 w-9"><AvatarImage src={accountPhotoUrl ?? undefined} alt={`${user.full_name} profile`} /><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback></Avatar>
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
