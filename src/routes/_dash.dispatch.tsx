import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { bookingsApi, cleanersApi, dispatchLiveUrl, type Booking } from "@/lib/api";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  LayoutGrid,
  ListFilter,
  MapPin,
  Rows3,
  Search,
  Sparkles,
  Clock,
  User,
} from "lucide-react";

export const Route = createFileRoute("/_dash/dispatch")({
  component: DispatchPage,
  head: () => ({
    meta: [
      { title: "Dispatch Board · Clean Match Operations" },
      {
        name: "description",
        content:
          "Drag-and-drop dispatch board to assign cleaners to jobs across zones, timeline and status lanes.",
      },
      { property: "og:title", content: "Dispatch Board · Clean Match Operations" },
      {
        property: "og:description",
        content: "Assign cleaners to jobs across zones, timeline and status lanes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Job = {
  id: string;
  service: string;
  packageName: string | null;
  propertyType: string | null;
  customer: string;
  address: string;
  zone: string;
  start: number; // hour
  duration: number; // hours
  amount: number;
  currency: string;
  priority: "Standard" | "Priority" | "VIP";
  status: "Unassigned" | "Assigned" | "In Progress" | "Completed";
  cleanerId: string | null;
  notes: string;
};

const HOURS = Array.from({ length: 11 }, (_, i) => 7 + i);
const COL = 104;
const localDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/*const INITIAL_JOBS: Job[] = [
  {
    id: "BK-2401",
    service: "Deep Clean",
    customer: "Amina Yusuf",
    address: "Kilimani, Nairobi",
    zone: "Kilimani",
    start: 10,
    duration: 4,
    amount: 4500,
    priority: "Priority",
    status: "In Progress",
    cleanerId: "CL-01",
    notes: "Gate code 4471. Two dogs on site.",
  },
  {
    id: "BK-2403",
    service: "Move Out",
    customer: "Cynthia Mwangi",
    address: "Karen, Nairobi",
    zone: "Karen",
    start: 9,
    duration: 6,
    amount: 7200,
    priority: "VIP",
    status: "Assigned",
    cleanerId: "CL-03",
    notes: "Landlord inspection at 16:00.",
  },
  {
    id: "BK-2404",
    service: "Office Clean",
    customer: "David Kimani",
    address: "Westlands, Nairobi",
    zone: "Westlands",
    start: 8,
    duration: 5,
    amount: 12500,
    priority: "Standard",
    status: "Assigned",
    cleanerId: "CL-02",
    notes: "Access badge at reception.",
  },
  {
    id: "BK-2407",
    service: "Standard Clean",
    customer: "Ruth Wanjala",
    address: "Runda, Nairobi",
    zone: "Runda",
    start: 13,
    duration: 2,
    amount: 2800,
    priority: "Standard",
    status: "Assigned",
    cleanerId: "CL-05",
    notes: "",
  },
  {
    id: "BK-2402",
    service: "Standard Clean",
    customer: "Brian Otieno",
    address: "Westlands, Nairobi",
    zone: "Westlands",
    start: 13,
    duration: 2,
    amount: 2800,
    priority: "Standard",
    status: "Unassigned",
    cleanerId: null,
    notes: "Customer prefers morning next time.",
  },
  {
    id: "BK-2406",
    service: "Deep Clean",
    customer: "Esther Njeri",
    address: "Lavington, Nairobi",
    zone: "Lavington",
    start: 11,
    duration: 4,
    amount: 4500,
    priority: "Priority",
    status: "Unassigned",
    cleanerId: null,
    notes: "Post-party clean, heavy kitchen.",
  },
  {
    id: "BK-2408",
    service: "Office Clean",
    customer: "Zawadi Ltd",
    address: "CBD, Nairobi",
    zone: "Nairobi CBD",
    start: 15,
    duration: 3,
    amount: 9800,
    priority: "VIP",
    status: "Unassigned",
    cleanerId: null,
    notes: "After hours only.",
  },
  {
    id: "BK-2409",
    service: "Standard Clean",
    customer: "Faith Kamau",
    address: "Kileleshwa, Nairobi",
    zone: "Kilimani",
    start: 9,
    duration: 2,
    amount: 2800,
    priority: "Standard",
    status: "Unassigned",
    cleanerId: null,
    notes: "",
  },
];*/

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
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toJob(source: Record<string, unknown> | Booking): Job {
  const item = source as Record<string, unknown>;
  const scheduled = new Date(String(item.scheduled_for));
  const status = String(item.status ?? "awaiting_assignment");
  const cleaner = item.cleaner as Booking["cleaner"] | undefined;
  const cleanerId = item.cleaner_id ? String(item.cleaner_id) : cleaner?.id ?? null;
  const completedStatuses = new Set(["completed", "payout_pending", "payout_paid"]);
  const displayStatus: Job["status"] = !cleanerId
    ? "Unassigned"
    : completedStatuses.has(status)
      ? "Completed"
      : status === "in_progress"
        ? "In Progress"
        : "Assigned";
  return {
    id: String(item.booking_id ?? item.id), service: String(item.service_name ?? "Service"), packageName: item.package_name ? String(item.package_name) : null, propertyType: item.property_type_name ? String(item.property_type_name) : null,
    customer: String(item.customer_name ?? "Customer name unavailable"),
    address: [item.address_line, item.city].filter(Boolean).join(", ") || "Address not provided",
    zone: String(item.city ?? "Unassigned"), start: scheduled.getHours(),
    duration: Math.max(1, Math.ceil(Number(item.estimated_duration_minutes ?? 60) / 60)), amount: Number(item.quoted_price ?? 0),
    currency: String(item.currency ?? "KES"), priority: "Standard", status: displayStatus,
    cleanerId, notes: String(item.special_instructions ?? ""),
  };
}

function timelineLanes(jobs: Job[]) {
  const layout = new Map<string, { lane: number; lanes: number }>();
  const ordered = [...jobs].sort((a, b) => a.start - b.start || a.duration - b.duration);
  let group: Job[] = [];
  let groupEnd = -Infinity;
  const placeGroup = () => {
    if (!group.length) return;
    const active: Array<{ end: number; lane: number }> = [];
    const lanes = new Map<string, number>();
    let laneCount = 0;
    group.forEach((job) => {
      const start = job.start;
      for (let index = active.length - 1; index >= 0; index -= 1) if (active[index].end <= start) active.splice(index, 1);
      const occupied = new Set(active.map((entry) => entry.lane));
      let lane = 0;
      while (occupied.has(lane)) lane += 1;
      active.push({ end: job.start + job.duration, lane });
      lanes.set(job.id, lane);
      laneCount = Math.max(laneCount, lane + 1);
    });
    group.forEach((job) => layout.set(job.id, { lane: lanes.get(job.id) ?? 0, lanes: laneCount }));
  };
  ordered.forEach((job) => {
    if (group.length && job.start >= groupEnd) { placeGroup(); group = []; groupEnd = -Infinity; }
    group.push(job);
    groupEnd = Math.max(groupEnd, job.start + job.duration);
  });
  placeGroup();
  return layout;
}

function DispatchPage() {
  const { can } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cleaners, setCleaners] = useState<Array<{ id: string; name: string; zone: string; availability: string; rating?: string | number | null; skills: string[] }>>([]);
  const [view, setView] = useState<"timeline" | "board" | "list">("timeline");
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("all");
  const [selected, setSelected] = useState<Job | null>(null);
  const [cleanerPickerOpen, setCleanerPickerOpen] = useState(false);
  const [selectedCleanerId, setSelectedCleanerId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const day = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + dayOffset);

  useEffect(() => {
    if (!can("bookings.read")) return;
    const startDate = localDateKey(day);
    Promise.all([bookingsApi.dispatchCalendar({ start_date: startDate, end_date: startDate }), bookingsApi.list({ assignment_status: "awaiting_assignment", start_date: startDate, end_date: startDate, limit: 200 }), can("cleaners.read") ? cleanersApi.list({ status: "active" }) : Promise.resolve([])]).then(([events, queue, profiles]) => {
      const calendarJobs = events.map(toJob);
      const queueJobs = queue.map(toJob);
      setJobs([...calendarJobs, ...queueJobs.filter((queued) => !calendarJobs.some((job) => job.id === queued.id))]);
        setCleaners(profiles.map((cleaner) => ({ id: cleaner.id, name: cleaner.full_name, zone: cleaner.service_area, availability: cleaner.is_available ? "Available" : "Unavailable", rating: cleaner.rating, skills: cleaner.skills.map((skill) => skill.name) })));
    }).catch((cause) => toast.error(cause instanceof Error ? cause.message : "Unable to load dispatch data."));
  }, [dayOffset, can, refreshKey]);

  const zones = useMemo(() => Array.from(new Set(cleaners.map((c) => c.zone))), []);
  const selectedCleaner = cleaners.find((cleaner) => cleaner.id === selectedCleanerId);

  useEffect(() => {
    setSelectedCleanerId(selected?.cleanerId ?? "");
    setCleanerPickerOpen(false);
  }, [selected?.id, selected?.cleanerId]);

  const visible = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (zone === "all" || j.zone === zone) &&
          (query === "" ||
            [j.id, j.customer, j.service, j.address]
              .join(" ")
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [jobs, zone, query],
  );

  const unassigned = visible.filter((j) => j.cleanerId === null);

  async function assign(jobId: string, cleanerId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    if (!can("bookings.assign")) { toast.error("You do not have permission to assign cleaners."); return; }
    const cleaner = cleaners.find((c) => c.id === cleanerId);
    try { const updated = await bookingsApi.assignCleaner(jobId, cleanerId, job.cleanerId ? "Reassigned from Dispatch Calendar." : "Assigned from Dispatch Calendar.");
    toast.success(
      `${job.service} assigned to ${cleaner?.name ?? "cleaner"}`,
      {
        description: `${job.service} · starts ${job.start}:00`,
      },
    ); setSelected(toJob(updated)); setRefreshKey((key) => key + 1); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Unable to assign cleaner."); setRefreshKey((key) => key + 1); }
  }

  useEffect(() => {
    const url = can("bookings.read") ? dispatchLiveUrl() : null;
    if (!url) return;
    const socket = new WebSocket(url);
    socket.onmessage = () => setRefreshKey((key) => key + 1);
    return () => socket.close();
  }, [can]);

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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDayOffset((d) => d - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs font-medium tabular-nums">
              {day.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDayOffset((d) => d + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter jobs…"
              className="h-8 w-44 pl-8 text-xs"
            />
          </div>

          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <ListFilter className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border bg-background p-0.5">
            {(
              [
                ["timeline", Columns3],
                ["board", LayoutGrid],
                ["list", Rows3],
              ] as const
            ).map(([v, Icon]) => (
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

        </div>

        <div className="flex-1 flex min-h-0">
          {/* Unassigned rail */}
          <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r bg-muted/30">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Unassigned queue
              </div>
              <Badge variant="secondary">{unassigned.length}</Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {unassigned.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    onClick={() => setSelected(j)}
                  />
                ))}
                {!unassigned.length && (
                  <div className="text-center text-xs text-muted-foreground py-10">
                    <Sparkles className="h-5 w-5 mx-auto mb-2 text-primary" />
                    Every job is dispatched.
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* Main surface */}
          <div className="flex-1 min-w-0 overflow-auto">
            {view === "timeline" && (
              <div className="min-w-[900px]">
                <div className="sticky top-0 z-10 flex bg-card/95 backdrop-blur border-b">
                  <div className="w-52 shrink-0 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Cleaner
                  </div>
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      style={{ width: COL }}
                      className="shrink-0 border-l px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center"
                    >
                      {h}:00
                    </div>
                  ))}
                </div>
                {cleaners.map((c) => {
                  const row = visible.filter((j) => j.cleanerId === c.id);
                  const laneLayout = timelineLanes(row);
                  return (
                    <div key={c.id} className="flex border-b group">
                      <div className="w-52 shrink-0 px-4 py-3 flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">
                            {initials(c.name)}
                          </AvatarFallback>
                        </Avatar>
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
                            className="shrink-0 border-l group-hover:bg-muted/30"
                          />
                        ))}
                        {row.map((j) => {
                          const placement = laneLayout.get(j.id) ?? { lane: 0, lanes: 1 };
                          const slotWidth = (j.duration * COL - 8) / placement.lanes;
                          return (
                          <button
                            key={j.id}
                            onClick={() => setSelected(j)}
                            style={{
                              left: (j.start - HOURS[0]) * COL + 4 + placement.lane * slotWidth,
                              width: Math.max(28, slotWidth - 4),
                            }}
                            className={`absolute top-2 bottom-2 rounded-md border px-2 py-1 text-left text-xs overflow-hidden ${statusTone[j.status]} ${conflicts.has(j.id) ? "ring-2 ring-destructive" : ""} hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing`}
                          >
                            <div className="font-medium truncate">{j.service}</div>
                            <div className="text-muted-foreground truncate">
                              {j.customer} · {j.start}:00
                            </div>
                          </button>
                          );
                        })}
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
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {status}
                        </span>
                        <Badge variant="secondary">{list.length}</Badge>
                      </div>
                      <div
                        className="rounded-lg border bg-muted/30 p-2 space-y-2 min-h-[260px]"
                      >
                        {list.map((j) => (
                          <JobCard
                            key={j.id}
                            job={j}
                            onClick={() => setSelected(j)}
                          />
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
                        <tr
                          key={j.id}
                          className="hover:bg-muted/40 cursor-pointer"
                          onClick={() => setSelected(j)}
                        >
                          <td className="px-4 py-2.5">{j.service}</td>
                          <td className="px-4 py-2.5">{j.customer}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{j.zone}</td>
                          <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                            {j.start}:00–{j.start + j.duration}:00
                          </td>
                          <td className="px-4 py-2.5">
                            {cleaners.find((c) => c.id === j.cleanerId)?.name ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="secondary">{j.status}</Badge>
                          </td>
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
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${priorityTone[selected.priority]}`}
                  >
                    {selected.priority}
                  </span>
                </SheetTitle>
                <SheetDescription>
                  {selected.currency} {selected.amount.toLocaleString()}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-4 text-sm">
                <Row icon={User} label="Customer" value={selected.customer} />
                <Row
                  icon={Sparkles}
                  label="Booking"
                  value={[selected.service, selected.packageName, selected.propertyType].filter(Boolean).join(" · ")}
                />
                <Row
                  icon={MapPin}
                  label="Address"
                  value={`${selected.address} (${selected.zone})`}
                />
                <Row
                  icon={Clock}
                  label="Window"
                  value={`${selected.start}:00 – ${selected.start + selected.duration}:00`}
                />
                <Separator />
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    {selected.cleanerId ? "Reassign cleaner" : "Assign cleaner"}
                  </div>
                  <Popover open={cleanerPickerOpen} onOpenChange={setCleanerPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={cleanerPickerOpen}
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate">
                          {selectedCleaner
                            ? `${selectedCleaner.name} · ${selectedCleaner.zone}`
                            : "Search and select a cleaner"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Search cleaner, area, or skill..." />
                        <CommandList>
                          <CommandEmpty>No cleaners match your search.</CommandEmpty>
                          <CommandGroup>
                            {cleaners.map((cleaner) => (
                              <CommandItem
                                key={cleaner.id}
                                value={`${cleaner.name} ${cleaner.zone} ${cleaner.skills.join(" ")}`}
                                disabled={cleaner.availability !== "Available"}
                                onSelect={() => {
                                  setSelectedCleanerId(cleaner.id);
                                  setCleanerPickerOpen(false);
                                }}
                              >
                                <Check
                                  className={`h-4 w-4 ${selectedCleanerId === cleaner.id ? "opacity-100" : "opacity-0"}`}
                                />
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="text-[10px]">
                                    {initials(cleaner.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium">{cleaner.name}</div>
                                  <div className="truncate text-[11px] text-muted-foreground">
                                    {cleaner.zone} · ★ {cleaner.rating ?? "—"}
                                    {cleaner.skills.length
                                      ? ` · ${cleaner.skills.join(", ")}`
                                      : " · No skills listed"}
                                  </div>
                                </div>
                                <Badge
                                  variant={cleaner.availability === "Available" ? "secondary" : "outline"}
                                  className="text-[10px]"
                                >
                                  {cleaner.availability}
                                </Badge>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button
                    className="mt-2 w-full"
                    disabled={
                      !can("bookings.assign") ||
                      !selectedCleaner ||
                      selectedCleaner.availability !== "Available"
                    }
                    onClick={() => void assign(selected.id, selectedCleanerId)}
                  >
                    {selected.cleanerId ? "Reassign cleaner" : "Assign cleaner"}
                  </Button>
                </div>
                <Separator />
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Dispatch notes
                  </div>
                  <p className="text-muted-foreground">
                    {selected.notes || "No notes for this job."}
                  </p>
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

function JobCard({
  job,
  onClick,
}: {
  job: Job;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group rounded-md border bg-card p-2.5 shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs font-medium">{job.service}</span>
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${priorityTone[job.priority]}`}>
          {job.priority}
        </span>
      </div>
      {(job.packageName || job.propertyType) && (
        <div className="mb-1 truncate text-[11px] text-muted-foreground">
          {[job.packageName, job.propertyType].filter(Boolean).join(" · ")}
        </div>
      )}
      <div className="text-xs text-muted-foreground truncate">{job.customer}</div>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {job.start}:00
        </span>
        <span className="inline-flex items-center gap-1 truncate">
          <MapPin className="h-3 w-3" />
          {job.zone}
        </span>
      </div>
    </div>
  );
}
