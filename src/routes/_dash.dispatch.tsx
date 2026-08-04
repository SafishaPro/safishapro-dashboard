import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cleaners } from "@/lib/mock-data";
import {
  CalendarDays, ChevronLeft, ChevronRight, Columns3, GripVertical, LayoutGrid,
  ListFilter, MapPin, Plus, Rows3, Search, Sparkles, Clock, User, Undo2, Zap,
} from "lucide-react";

export const Route = createFileRoute("/_dash/dispatch")({
  component: DispatchPage,
  head: () => ({
    meta: [
      { title: "Dispatch Board · SafishaPro Operations" },
      { name: "description", content: "Drag-and-drop dispatch board to assign cleaners to jobs across zones, timeline and status lanes." },
      { property: "og:title", content: "Dispatch Board · SafishaPro Operations" },
      { property: "og:description", content: "Assign cleaners to jobs across zones, timeline and status lanes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Job = {
  id: string;
  service: string;
  customer: string;
  address: string;
  zone: string;
  start: number; // hour
  duration: number; // hours
  amount: number;
  priority: "Standard" | "Priority" | "VIP";
  status: "Unassigned" | "Assigned" | "In Progress" | "Completed";
  cleanerId: string | null;
  notes: string;
};

const HOURS = Array.from({ length: 11 }, (_, i) => 7 + i);
const COL = 104;

const INITIAL_JOBS: Job[] = [
  { id: "BK-2401", service: "Deep Clean", customer: "Amina Yusuf", address: "Kilimani, Nairobi", zone: "Kilimani", start: 10, duration: 4, amount: 4500, priority: "Priority", status: "In Progress", cleanerId: "CL-01", notes: "Gate code 4471. Two dogs on site." },
  { id: "BK-2403", service: "Move Out", customer: "Cynthia Mwangi", address: "Karen, Nairobi", zone: "Karen", start: 9, duration: 6, amount: 7200, priority: "VIP", status: "Assigned", cleanerId: "CL-03", notes: "Landlord inspection at 16:00." },
  { id: "BK-2404", service: "Office Clean", customer: "David Kimani", address: "Westlands, Nairobi", zone: "Westlands", start: 8, duration: 5, amount: 12500, priority: "Standard", status: "Assigned", cleanerId: "CL-02", notes: "Access badge at reception." },
  { id: "BK-2407", service: "Standard Clean", customer: "Ruth Wanjala", address: "Runda, Nairobi", zone: "Runda", start: 13, duration: 2, amount: 2800, priority: "Standard", status: "Assigned", cleanerId: "CL-05", notes: "" },
  { id: "BK-2402", service: "Standard Clean", customer: "Brian Otieno", address: "Westlands, Nairobi", zone: "Westlands", start: 13, duration: 2, amount: 2800, priority: "Standard", status: "Unassigned", cleanerId: null, notes: "Customer prefers morning next time." },
  { id: "BK-2406", service: "Deep Clean", customer: "Esther Njeri", address: "Lavington, Nairobi", zone: "Lavington", start: 11, duration: 4, amount: 4500, priority: "Priority", status: "Unassigned", cleanerId: null, notes: "Post-party clean, heavy kitchen." },
  { id: "BK-2408", service: "Office Clean", customer: "Zawadi Ltd", address: "CBD, Nairobi", zone: "Nairobi CBD", start: 15, duration: 3, amount: 9800, priority: "VIP", status: "Unassigned", cleanerId: null, notes: "After hours only." },
  { id: "BK-2409", service: "Standard Clean", customer: "Faith Kamau", address: "Kileleshwa, Nairobi", zone: "Kilimani", start: 9, duration: 2, amount: 2800, priority: "Standard", status: "Unassigned", cleanerId: null, notes: "" },
];

const priorityTone: Record<Job["priority"], string> = {
  Standard: "bg-muted text-muted-foreground",
  Priority: "bg-primary/15 text-primary",
  VIP: "bg-accent text-accent-foreground",
};

const statusTone: Record<Job["status"], string> = {
  Unassigned: "border-border bg-muted/60",
  Assigned: "border-primary/40 bg-primary/10",
  "In Progress": "border-primary bg-primary/20",
  Completed: "border-border bg-muted",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function DispatchPage() {
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [view, setView] = useState<"timeline" | "board" | "list">("timeline");
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<Job | null>(null);
  const [history, setHistory] = useState<Job[][]>([]);
  const [dayOffset, setDayOffset] = useState(0);

  const zones = useMemo(() => Array.from(new Set(cleaners.map((c) => c.zone))), []);

  const visible = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (zone === "all" || j.zone === zone) &&
          (query === "" ||
            [j.id, j.customer, j.service, j.address].join(" ").toLowerCase().includes(query.toLowerCase())),
      ),
    [jobs, zone, query],
  );

  const unassigned = visible.filter((j) => j.cleanerId === null);
  const day = new Date(2026, 7, 4 + dayOffset);

  function commit(next: Job[]) {
    setHistory((h) => [...h, jobs].slice(-10));
    setJobs(next);
  }

  function assign(jobId: string, cleanerId: string | null, start?: number) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    const cleaner = cleaners.find((c) => c.id === cleanerId);
    commit(
      jobs.map((j) =>
        j.id === jobId
          ? { ...j, cleanerId, start: start ?? j.start, status: cleanerId ? (j.status === "Unassigned" ? "Assigned" : j.status) : "Unassigned" }
          : j,
      ),
    );
    toast.success(
      cleanerId ? `${job.id} assigned to ${cleaner?.name}` : `${job.id} moved back to the queue`,
      { description: cleanerId ? `${job.service} · starts ${start ?? job.start}:00` : "Waiting in unassigned queue" },
    );
  }

  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      setJobs(h[h.length - 1]);
      toast("Last dispatch action undone", { icon: <Undo2 className="h-4 w-4" /> });
      return h.slice(0, -1);
    });
  }

  function autoAssign() {
    let next = [...jobs];
    let count = 0;
    for (const job of next.filter((j) => !j.cleanerId)) {
      const match =
        cleaners.find((c) => c.zone === job.zone && c.availability === "Available") ??
        cleaners.find((c) => c.availability === "Available");
      if (!match) continue;
      next = next.map((j) => (j.id === job.id ? { ...j, cleanerId: match.id, status: "Assigned" as const } : j));
      count++;
    }
    commit(next);
    toast.success(`Auto-dispatch matched ${count} job${count === 1 ? "" : "s"}`, { description: "Balanced by zone and availability" });
  }

  const conflicts = useMemo(() => {
    const set = new Set<string>();
    for (const a of jobs) {
      for (const b of jobs) {
        if (a.id === b.id || !a.cleanerId || a.cleanerId !== b.cleanerId) continue;
        if (a.start < b.start + b.duration && b.start < a.start + a.duration) set.add(a.id);
      }
    }
    return set;
  }, [jobs]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-8rem)] -m-4 md:-m-8">
        {/* Toolbar */}
        <div className="border-b bg-card/80 backdrop-blur px-4 md:px-6 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-auto">
            <div className="h-8 w-8 rounded-md bg-primary/10 grid place-items-center">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Dispatch Board</h1>
              <p className="text-xs text-muted-foreground leading-tight">
                {visible.length} jobs · {unassigned.length} unassigned · {conflicts.size} conflicts
              </p>
            </div>
          </div>

          <div className="flex items-center rounded-md border bg-background">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDayOffset((d) => d - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs font-medium tabular-nums">
              {day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDayOffset((d) => d + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter jobs…" className="h-8 w-44 pl-8 text-xs" />
          </div>

          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <ListFilter className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border bg-background p-0.5">
            {([["timeline", Columns3], ["board", LayoutGrid], ["list", Rows3]] as const).map(([v, Icon]) => (
              <Tooltip key={v}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setView(v)}
                    className={`h-7 w-7 grid place-items-center rounded ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="capitalize">{v} view</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <Button variant="outline" size="sm" className="h-8" onClick={undo} disabled={!history.length}>
            <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
          </Button>
          <Button size="sm" className="h-8" onClick={autoAssign}>
            <Zap className="h-3.5 w-3.5 mr-1" /> Auto-dispatch
          </Button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Unassigned rail */}
          <aside
            className={`hidden lg:flex w-72 shrink-0 flex-col border-r bg-muted/30 ${hover === "queue" ? "ring-2 ring-inset ring-primary" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setHover("queue"); }}
            onDragLeave={() => setHover(null)}
            onDrop={() => { if (dragId) assign(dragId, null); setHover(null); setDragId(null); }}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unassigned queue</div>
              <Badge variant="secondary">{unassigned.length}</Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {unassigned.map((j) => (
                  <JobCard key={j.id} job={j} onDragStart={() => setDragId(j.id)} onClick={() => setSelected(j)} />
                ))}
                {!unassigned.length && (
                  <div className="text-center text-xs text-muted-foreground py-10">
                    <Sparkles className="h-5 w-5 mx-auto mb-2 text-primary" />
                    Every job is dispatched.
                  </div>
                )}
                <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
                  <Plus className="h-3.5 w-3.5 mr-1" /> New job
                </Button>
              </div>
            </ScrollArea>
          </aside>

          {/* Main surface */}
          <div className="flex-1 min-w-0 overflow-auto">
            {view === "timeline" && (
              <div className="min-w-[900px]">
                <div className="sticky top-0 z-10 flex bg-card/95 backdrop-blur border-b">
                  <div className="w-52 shrink-0 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Cleaner</div>
                  {HOURS.map((h) => (
                    <div key={h} style={{ width: COL }} className="shrink-0 border-l px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">
                      {h}:00
                    </div>
                  ))}
                </div>
                {cleaners.map((c) => {
                  const row = visible.filter((j) => j.cleanerId === c.id);
                  return (
                    <div key={c.id} className="flex border-b group">
                      <div className="w-52 shrink-0 px-4 py-3 flex items-center gap-2">
                        <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(c.name)}</AvatarFallback></Avatar>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3" /> {c.zone} · ★ {c.rating}
                          </div>
                        </div>
                      </div>
                      <div className="relative flex" style={{ height: 68 }}>
                        {HOURS.map((h) => (
                          <div
                            key={h}
                            style={{ width: COL }}
                            className={`shrink-0 border-l ${hover === `${c.id}-${h}` ? "bg-primary/10" : "group-hover:bg-muted/30"}`}
                            onDragOver={(e) => { e.preventDefault(); setHover(`${c.id}-${h}`); }}
                            onDragLeave={() => setHover(null)}
                            onDrop={() => { if (dragId) assign(dragId, c.id, h); setHover(null); setDragId(null); }}
                          />
                        ))}
                        {row.map((j) => (
                          <button
                            key={j.id}
                            draggable
                            onDragStart={() => setDragId(j.id)}
                            onClick={() => setSelected(j)}
                            style={{ left: (j.start - HOURS[0]) * COL + 4, width: j.duration * COL - 8 }}
                            className={`absolute top-2 bottom-2 rounded-md border px-2 py-1 text-left text-xs overflow-hidden ${statusTone[j.status]} ${conflicts.has(j.id) ? "ring-2 ring-destructive" : ""} hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing`}
                          >
                            <div className="font-medium truncate">{j.service}</div>
                            <div className="text-muted-foreground truncate">{j.customer} · {j.start}:00</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {view === "board" && (
              <div className="p-4 flex gap-4 min-w-[900px]">
                {(["Unassigned", "Assigned", "In Progress", "Completed"] as const).map((status) => {
                  const list = visible.filter((j) => j.status === status);
                  return (
                    <div key={status} className="w-72 shrink-0">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{status}</span>
                        <Badge variant="secondary">{list.length}</Badge>
                      </div>
                      <div
                        className={`rounded-lg border bg-muted/30 p-2 space-y-2 min-h-[260px] ${hover === `col-${status}` ? "ring-2 ring-primary" : ""}`}
                        onDragOver={(e) => { e.preventDefault(); setHover(`col-${status}`); }}
                        onDragLeave={() => setHover(null)}
                        onDrop={() => {
                          if (dragId) {
                            commit(jobs.map((j) => (j.id === dragId ? { ...j, status, cleanerId: status === "Unassigned" ? null : j.cleanerId } : j)));
                            toast.success(`${dragId} → ${status}`);
                          }
                          setHover(null); setDragId(null);
                        }}
                      >
                        {list.map((j) => (
                          <JobCard key={j.id} job={j} onDragStart={() => setDragId(j.id)} onClick={() => setSelected(j)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {view === "list" && (
              <div className="p-4">
                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2">Job</th>
                        <th className="px-4 py-2">Service</th>
                        <th className="px-4 py-2">Customer</th>
                        <th className="px-4 py-2">Zone</th>
                        <th className="px-4 py-2">Window</th>
                        <th className="px-4 py-2">Cleaner</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {visible.map((j) => (
                        <tr key={j.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setSelected(j)}>
                          <td className="px-4 py-2.5 font-medium">{j.id}</td>
                          <td className="px-4 py-2.5">{j.service}</td>
                          <td className="px-4 py-2.5">{j.customer}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{j.zone}</td>
                          <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{j.start}:00–{j.start + j.duration}:00</td>
                          <td className="px-4 py-2.5">{cleaners.find((c) => c.id === j.cleanerId)?.name ?? <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-2.5"><Badge variant="secondary">{j.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.service}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityTone[selected.priority]}`}>{selected.priority}</span>
                </SheetTitle>
                <SheetDescription>{selected.id} · KES {selected.amount.toLocaleString()}</SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-4 text-sm">
                <Row icon={User} label="Customer" value={selected.customer} />
                <Row icon={MapPin} label="Address" value={`${selected.address} (${selected.zone})`} />
                <Row icon={Clock} label="Window" value={`${selected.start}:00 – ${selected.start + selected.duration}:00`} />
                <Separator />
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Assign cleaner</div>
                  <div className="space-y-1.5">
                    {cleaners.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { assign(selected.id, c.id); setSelected({ ...selected, cleanerId: c.id, status: "Assigned" }); }}
                        className={`w-full flex items-center gap-2 rounded-md border px-2.5 py-2 text-left hover:bg-muted ${selected.cleanerId === c.id ? "border-primary bg-primary/10" : ""}`}
                      >
                        <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(c.name)}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground">{c.zone} · ★ {c.rating}</div>
                        </div>
                        <Badge variant={c.availability === "Available" ? "secondary" : "outline"} className="text-[10px]">{c.availability}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Dispatch notes</div>
                  <p className="text-muted-foreground">{selected.notes || "No notes for this job."}</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div>{value}</div>
      </div>
    </div>
  );
}

function JobCard({ job, onDragStart, onClick }: { job: Job; onDragStart: () => void; onClick: () => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group rounded-md border bg-card p-2.5 shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
        <span className="text-xs font-medium">{job.service}</span>
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${priorityTone[job.priority]}`}>{job.priority}</span>
      </div>
      <div className="text-xs text-muted-foreground truncate">{job.customer}</div>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{job.start}:00</span>
        <span className="inline-flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{job.zone}</span>
      </div>
    </div>
  );
}
