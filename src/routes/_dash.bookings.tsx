import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bookingsApi, cleanersApi, paymentsApi, servicesApi, usersApi, type ApiUser, type Booking, type Cleaner, type Payment, type PropertyType, type Service } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LocationPicker, type LocationPickerValue } from "@/components/location-picker";

export const Route = createFileRoute("/_dash/bookings")({ component: BookingsPage });
const statuses = [
  "pending",
  "awaiting_payment",
  "payment_verified",
  "awaiting_assignment",
  "assigned",
  "cleaner_en_route",
  "in_progress",
  "completed",
  "payout_pending",
  "payout_paid",
  "payment_failed",
  "cancelled",
  "refund_requested",
  "refunded",
  "no_show",
];
const emptyBookingForm = {
  scheduled_for: "",
  address_mode: "inline" as "inline" | "saved",
  saved_address_id: "",
  address_line: "",
  city: "",
  latitude: "",
  longitude: "",
  special_instructions: "",
  additional_notes: "",
  recurrence_end_date: "",
  session_days: "",
};
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatBookingDate = (value: string) => {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")} ${part("month")}, ${part("year")} ${part("hour")}:${part("minute")}${part("dayPeriod").toUpperCase()}`;
};
function BookingsPage() {
  const { can } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [transitions, setTransitions] = useState<Array<{ status: string; action_label: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [focused, setFocused] = useState<{ mode: "active" | "upcoming" | "none"; booking: Booking | null; message: string } | null>(null);
  const load = async (nextPage = page) => {
    if (startDate && endDate && startDate > endDate) {
      setError("Start date cannot be after end date.");
      return;
    }
    try {
      setError(null);
      const result = await bookingsApi.list({
          status: status === "all" ? undefined : status,
          search: search || undefined,
          city: city || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          limit: pageSize + 1,
          offset: (nextPage - 1) * pageSize,
        });
      setBookings(result.slice(0, pageSize));
      setHasNextPage(result.length > pageSize);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load bookings.");
    }
  };
  useEffect(() => { void load(1); }, [pageSize]);
  const mutate = async (work: () => Promise<Booking>) => {
    try {
      const updated = await work();
      setSelected(updated);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update booking.");
    }
  };
  const open = async (booking: Booking) => { try { const [full, controls] = await Promise.all([bookingsApi.get(booking.id), can("bookings.update") ? bookingsApi.statusTransitions(booking.id) : Promise.resolve(null)]); setSelected(full); setTransitions(controls?.allowed_transitions ?? []); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load booking details."); } };
  const loadFocusedSession = async () => { try { setFocused(await bookingsApi.focusedSession()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load the focused session."); } };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Search, inspect, assign and manage live booking status."
        actions={
          <div className="flex gap-2">
            {can("bookings.create") && <Button type="button" className="bg-blue-700 text-white hover:bg-blue-800" onClick={() => { setSelected(null); setCreating(true); }}>Create booking</Button>}
            {can("bookings.read") && <Button className="bg-violet-700 text-white hover:bg-violet-800" onClick={() => void loadFocusedSession()}>Focused session</Button>}
            {(can("reports.read") || can("analytics.read")) && <Button className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => setReportOpen(true)}>Package performance</Button>}
            <Button className="bg-slate-600 text-white hover:bg-slate-700" onClick={() => void load()}>Refresh</Button>
          </div>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card className="p-4">
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            className="max-w-sm"
            placeholder="Search bookings, customers, or services"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Input
            className="w-44"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input aria-label="Booking start date" className="w-40" type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} />
          <Input aria-label="Booking end date" className="w-40" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
          <Button onClick={() => void load(1)}>Apply filters</Button>
          <Button variant="ghost" onClick={() => { setStatus("all"); setSearch(""); setCity(""); setStartDate(""); setEndDate(""); }}>Reset</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Cleaner</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking, index) => (
              <TableRow key={booking.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {String((page - 1) * pageSize + index + 1).padStart(2, "0")}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{booking.service_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {booking.package_name || "No package"} · {booking.city || "—"}
                  </p>
                </TableCell>
                <TableCell>{booking.cleaner?.full_name || "Unassigned"}</TableCell>
                <TableCell>{formatBookingDate(booking.scheduled_for)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      booking.status === "completed"
                        ? "success"
                        : booking.status === "cancelled" || booking.status === "payment_failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {titleCase(booking.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {booking.currency} {Number(booking.quoted_price).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {can("bookings.assign") && !booking.cleaner && booking.assignment_status === "awaiting_assignment" && booking.status === "awaiting_assignment" && <Button size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => void open(booking)}>Assign cleaner</Button>}
                    <Button
                      size="sm"
                      className="bg-blue-950 text-white hover:bg-blue-900"
                      onClick={() => void open(booking)}
                    >
                      View details
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!bookings.length && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No bookings found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {bookings.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm"><p className="text-muted-foreground">Showing {((page - 1) * pageSize) + 1}-{((page - 1) * pageSize) + bookings.length}</p><div className="flex items-center gap-2"><Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10 per page</SelectItem><SelectItem value="25">25 per page</SelectItem><SelectItem value="50">50 per page</SelectItem></SelectContent></Select><Button size="sm" variant="outline" disabled={page === 1} onClick={() => void load(page - 1)}>Previous</Button><span className="text-muted-foreground">Page {page}</span><Button size="sm" variant="outline" disabled={!hasNextPage} onClick={() => void load(page + 1)}>Next</Button></div></div>}
      </Card>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Service", selected.service_name],
                  ["Package", selected.package_name],
                  ["Status", selected.status.replaceAll("_", " ")],
                  ["Scheduled", new Date(selected.scheduled_for).toLocaleString()],
                  ["Cleaner", selected.cleaner?.full_name],
                  ["Assigned at", selected.assigned_at ? new Date(selected.assigned_at).toLocaleString() : "Not assigned"],
                  ["Session", selected.recurring_plan ? `Cycle ${selected.cycle_number ?? "-"}, visit ${selected.session_number ?? "-"}` : "One-time booking"],
                  ["Address", [selected.address_line, selected.city].filter(Boolean).join(", ")],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value || "—"}</p>
                  </div>
                ))}
              </div>
              {!selected.cleaner && <AssignmentPanel booking={selected} can={can} onBookingChanged={(next) => { setSelected(next); void load(); }} />}
              <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Price</p><p className="font-medium">{selected.currency} {Number(selected.quoted_price).toLocaleString()}</p></div><div><p className="text-xs text-muted-foreground">Property</p><p className="font-medium">{selected.property_type?.name ?? selected.property_size?.replaceAll("_", " ") ?? "—"}</p>{selected.property_details && Object.keys(selected.property_details).length > 0 && <p className="mt-1 text-xs text-muted-foreground">{Object.entries(selected.property_details).map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`).join(" · ")}</p>}</div><div><p className="text-xs text-muted-foreground">Cleaner contact</p><p className="font-medium">{selected.cleaner?.phone ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">Cleaner rating</p><p className="font-medium">{selected.cleaner?.rating ?? "—"}</p></div></div>
              {(selected.special_instructions || selected.additional_notes || selected.additional_services?.length) && <div className="rounded-lg border p-3 text-sm"><h3 className="font-medium">Service notes and add-ons</h3>{selected.special_instructions && <p className="mt-2 text-muted-foreground">{selected.special_instructions}</p>}{selected.additional_notes && <p className="mt-1 text-muted-foreground">{selected.additional_notes}</p>}{selected.additional_services?.length ? <p className="mt-2 text-xs text-muted-foreground">Add-ons: {selected.additional_services.map((service) => `${service.name ?? "Service"} × ${service.quantity ?? 1}`).join(", ")}</p> : null}</div>}
              <BookingPaymentPanel booking={selected} can={can} onBookingChanged={(next) => { setSelected(next); void load(); }} />
              <OperationsSupport booking={selected} can={can} onBookingChanged={(next) => { setSelected(next); void load(); }} />
              <div className="flex flex-wrap gap-2">
                {can("bookings.update") && transitions.map((transition) => <Button key={transition.status} onClick={() => mutate(() => bookingsApi.changeStatus(selected.id, transition.status))}>{transition.action_label}</Button>)}
                {can("bookings.update") && <Button
                  variant="outline"
                  onClick={() => {
                    const scheduled_for = window.prompt(
                      "New scheduled time (ISO 8601)",
                      selected.scheduled_for,
                    );
                    if (scheduled_for)
                      mutate(() => bookingsApi.reschedule(selected.id, scheduled_for));
                  }}
                >
                  Reschedule
                </Button>}
                {can("bookings.update") && <Button
                  variant="destructive"
                  onClick={() => {
                    const reason = window.prompt("Cancellation reason");
                    if (reason) mutate(() => bookingsApi.cancel(selected.id, reason));
                  }}
                >
                  Cancel booking
                </Button>}
              </div>
              {selected.status_events.length > 0 && <div><h3 className="mb-2 font-medium">Booking history</h3><div className="max-h-40 divide-y overflow-y-auto rounded-md border">{selected.status_events.map((event, index) => <div key={`${event.created_at}-${index}`} className="p-2 text-sm"><span className="font-medium">{event.to_status ?? event.status ?? "Updated"}</span>{event.from_status && <span className="text-muted-foreground"> from {event.from_status}</span>}{event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}<p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p></div>)}</div></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(focused)} onOpenChange={(open) => !open && setFocused(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Focused session</DialogTitle></DialogHeader>{focused && <div className="space-y-3 text-sm">{focused.booking ? <><Badge variant={focused.mode === "active" ? "success" : "secondary"}>{focused.mode === "active" ? "In progress" : "Up next"}</Badge><div className="rounded-md border p-4"><p className="font-medium">{focused.booking.service_name} · {focused.booking.package_name ?? "No package"}</p><p className="mt-1 text-muted-foreground">{new Date(focused.booking.scheduled_for).toLocaleString()}</p><p className="mt-1 text-muted-foreground">{focused.booking.cleaner?.full_name ?? "Cleaner not assigned"}</p><p className="mt-1 text-muted-foreground">{[focused.booking.address_line, focused.booking.city].filter(Boolean).join(", ") || "Address unavailable"}</p></div><Button onClick={() => { setFocused(null); void open(focused.booking!); }}>Open booking</Button></> : <p className="text-muted-foreground">{focused.message}</p>}</div>}</DialogContent></Dialog>
      {(can("reports.read") || can("analytics.read")) && <PackagePerformanceDialog open={reportOpen} onOpenChange={setReportOpen} />}
      <CreateBookingDialog open={creating} onOpenChange={setCreating} onCreated={() => void load(1)} />
    </div>
  );
}

function BookingPaymentPanel({ booking, can, onBookingChanged }: { booking: Booking; can: (...permissions: string[]) => boolean; onBookingChanged: (booking: Booking) => void }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [note, setNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canView = can("payments.read") || can("payments.verify");
  const load = async () => { if (!canView) return; try { setError(null); setPayments(await paymentsApi.list({ booking_id: booking.id, limit: 20 })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load payment status."); } };
  useEffect(() => { void load(); }, [booking.id]);
  const openPayment = payments.find((payment) => ["initiated", "pending"].includes(payment.status));
  const beginVerification = () => { setReceiptNumber(""); setNote(""); setIdempotencyKey(`mark-paid-${booking.id}-${crypto.randomUUID()}`); };
  const markPaid = async () => {
    if (!receiptNumber.trim() || !idempotencyKey) return;
    setBusy(true);
    try {
      setError(null);
      await paymentsApi.markBookingPaid(booking.id, { receipt_number: receiptNumber.trim(), ...(note.trim() ? { note: note.trim() } : {}), idempotency_key: idempotencyKey });
      setReceiptNumber(""); setNote(""); setIdempotencyKey("");
      await load();
      onBookingChanged(await bookingsApi.get(booking.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to mark this booking as paid."); } finally { setBusy(false); }
  };
  if (!canView) return null;
  return <section className="space-y-3 rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium">Payment</h3><p className="text-xs text-muted-foreground">A successful payment releases this booking to Dispatch.</p></div><Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={busy}>Refresh payment</Button></div>{error && <p className="text-sm text-destructive">{error}</p>}{payments.length ? <div className="space-y-2">{payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/60 p-3 text-sm"><div><p className="font-medium">{payment.currency} {Number(payment.amount).toLocaleString()} · {payment.provider}</p><p className="text-xs text-muted-foreground">{payment.receipt_number ? `Receipt: ${payment.receipt_number}` : "No receipt recorded"}</p></div><Badge variant={payment.status === "successful" ? "success" : ["failed", "timed_out"].includes(payment.status) ? "destructive" : "secondary"}>{payment.status.replaceAll("_", " ")}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">No payment attempt has been created for this booking yet.</p>}{can("payments.verify") && booking.status === "awaiting_payment" && openPayment && <div className="space-y-2 border-t pt-3">{!idempotencyKey ? <Button type="button" onClick={beginVerification}>Mark as paid</Button> : <><p className="text-sm font-medium">Confirm external payment</p><Input value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value)} placeholder="Receipt or bank reference number" /><Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal note (optional)" /><div className="flex gap-2"><Button type="button" disabled={busy || receiptNumber.trim().length < 3} onClick={() => void markPaid()}>{busy ? "Confirming…" : "Confirm payment"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setIdempotencyKey("")}>Cancel</Button></div></>}</div>}{can("payments.verify") && booking.status === "awaiting_payment" && !openPayment && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">An initiated or pending payment attempt is required before it can be marked as paid.</p>}</section>;
}

function PackagePerformanceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const today = new Date();
  const initialEnd = today.toISOString().slice(0, 10);
  const initialStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [services, setServices] = useState<Service[]>([]);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [serviceId, setServiceId] = useState("all");
  const [packageId, setPackageId] = useState("all");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const selectedService = services.find((service) => service.id === serviceId);
  useEffect(() => { if (open) void servicesApi.list().then(setServices).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load services.")); }, [open]);
  const loadReport = async () => {
    if (!startDate || !endDate || startDate > endDate) { setError("Choose a valid report period."); return; }
    setLoading(true); try { setError(null); setReport(await bookingsApi.packageSummary({ start_date: startDate, end_date: endDate, ...(serviceId !== "all" ? { service_type_id: serviceId } : {}), ...(packageId !== "all" ? { service_package_id: packageId } : {}) })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load package performance."); } finally { setLoading(false); }
  };
  const packageRows = (report?.packages ?? report?.items ?? report?.package_summaries ?? []) as Array<Record<string, unknown>>;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>Package performance</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-muted-foreground">Compare booking volume, recurring sessions, and quoted value by package. Amounts remain separated by currency.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Start date"><Input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></Field><Field label="End date"><Input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></Field><Field label="Service"><Select value={serviceId} onValueChange={(value) => { setServiceId(value); setPackageId("all"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All services</SelectItem>{services.map((service) => <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Package"><Select value={packageId} onValueChange={setPackageId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All packages</SelectItem>{selectedService?.packages.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field></div><Button onClick={() => void loadReport()} disabled={loading}>{loading ? "Loading…" : "Run report"}</Button>{error && <p className="text-sm text-destructive">{error}</p>}{report && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><ReportMetric label="Total bookings" value={report.total_bookings} /><ReportMetric label="Recurring bookings" value={report.recurring_bookings ?? report.total_recurring_bookings} /><ReportMetric label="Period" value={`${String(report.start_date ?? startDate)} to ${String(report.end_date ?? endDate)}`} /></div>{Object.entries((report.quoted_value_by_currency ?? {}) as Record<string, unknown>).length > 0 && <div className="rounded-md border p-3 text-sm"><p className="font-medium">Quoted value</p><div className="mt-2 flex flex-wrap gap-3">{Object.entries(report.quoted_value_by_currency as Record<string, unknown>).map(([currency, value]) => <Badge key={currency} variant="secondary">{currency} {Number(value).toLocaleString()}</Badge>)}</div></div>}<PackageCharts rows={packageRows} /><div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Package</TableHead><TableHead>Pricing</TableHead><TableHead className="text-right">Bookings</TableHead><TableHead className="text-right">Recurring</TableHead><TableHead className="text-right">Quoted value</TableHead></TableRow></TableHeader><TableBody>{packageRows.map((item, index) => <TableRow key={String(item.service_package_id ?? item.package_id ?? index)}><TableCell><p className="font-medium">{String(item.package_name ?? item.name ?? "Package")}</p><p className="text-xs text-muted-foreground">{String(item.service_name ?? "")}</p></TableCell><TableCell>{String(item.pricing_model ?? "—").replaceAll("_", " ")} · {String(item.billing_cycle ?? "—").replaceAll("_", " ")}</TableCell><TableCell className="text-right">{Number(item.booking_count ?? item.total_bookings ?? 0).toLocaleString()}</TableCell><TableCell className="text-right">{Number(item.recurring_booking_count ?? item.recurring_bookings ?? 0).toLocaleString()}</TableCell><TableCell className="text-right">{String(item.currency ?? "")} {Number(item.quoted_value ?? item.total_quoted_value ?? 0).toLocaleString()}</TableCell></TableRow>)}{!packageRows.length && <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No package activity matches this period.</TableCell></TableRow>}</TableBody></Table></div></div>}</div></DialogContent></Dialog>;
}

function PackageCharts({ rows }: { rows: Array<Record<string, unknown>> }) {
  const data = rows.slice(0, 10).map((item) => ({ name: String(item.package_name ?? item.name ?? "Package"), bookings: Number(item.booking_count ?? item.total_bookings ?? 0), recurring: Number(item.recurring_booking_count ?? item.recurring_bookings ?? 0) }));
  if (!data.length) return null;
  return <div className="rounded-lg border bg-muted/20 p-4"><div className="mb-4"><h3 className="font-medium">Booking demand by package</h3><p className="text-xs text-muted-foreground">The ten packages with the highest quoted value in the selected period.</p></div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={60} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip cursor={{ fill: "hsl(var(--muted))" }} /><Legend /><Bar dataKey="bookings" name="All bookings" fill="#2563eb" radius={[4, 4, 0, 0]} /><Bar dataKey="recurring" name="Recurring" fill="#8b5cf6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>;
}

function ReportMetric({ label, value }: { label: string; value: unknown }) { return <div className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value == null ? "—" : typeof value === "number" ? value.toLocaleString() : String(value)}</p></div>; }

type CleanerCandidate = { cleaner_id: string; full_name: string; service_area: string; rating: number | null; distance_km: number | null; current_assignments: number; score: number };

function AssignmentPanel({ booking, can, onBookingChanged }: { booking: Booking; can: (...permissions: string[]) => boolean; onBookingChanged: (booking: Booking) => void }) {
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCleanerId, setSelectedCleanerId] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assignable = ["awaiting_assignment", "assigned"].includes(booking.status);
  const loadCleaners = async (query = "") => { if (!assignable || !can("bookings.assign") || !can("cleaners.read")) return; if (query.trim().length === 1) { setCleaners([]); return; } setLoading(true); try { setError(null); setCleaners(await cleanersApi.list({ status: "active", ...(query.trim().length >= 2 ? { search: query.trim() } : {}) })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load active cleaners."); } finally { setLoading(false); } };
  useEffect(() => { void loadCleaners(); }, [booking.id, booking.status]);
  useEffect(() => { const query = search.trim(); if (!showResults || query.length === 1) return; const timer = window.setTimeout(() => { void loadCleaners(query); }, query.length >= 2 ? 250 : 0); return () => window.clearTimeout(timer); }, [search, showResults]);
  const assign = async () => { if (!selectedCleanerId) return; setLoading(true); try { setError(null); const updated = await bookingsApi.assignCleaner(booking.id, selectedCleanerId, "Assigned from booking details."); onBookingChanged(updated); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update cleaner assignment."); } finally { setLoading(false); } };
  if (!can("bookings.assign") || !assignable) return null;
  return <section className="space-y-3 rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium">Assign cleaner</h3><p className="text-xs text-muted-foreground">Search by cleaner name, phone number, or national ID, then choose a result.</p></div><Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void loadCleaners(search)}>Refresh</Button></div>{!can("cleaners.read") ? <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">You need cleaner-view access to select a cleaner for this booking.</p> : <><div className="relative"><Input value={search} onFocus={() => setShowResults(true)} onChange={(event) => { setSearch(event.target.value); setSelectedCleanerId(""); setShowResults(true); }} placeholder="Search and select an active cleaner" aria-label="Search active cleaners" />{showResults && <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">{loading ? <p className="px-3 py-2 text-sm text-muted-foreground">Searching cleaners…</p> : cleaners.length ? cleaners.map((cleaner) => <button key={cleaner.id} type="button" className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setSelectedCleanerId(cleaner.id); setSearch(cleaner.full_name); setShowResults(false); }}><span className="block font-medium">{cleaner.full_name}</span><span className="block text-xs text-muted-foreground">{cleaner.phone} · {cleaner.service_area || "Area not set"}{cleaner.is_available ? " · Available" : ""}</span></button>) : <p className="px-3 py-2 text-sm text-muted-foreground">{search.trim().length === 1 ? "Type one more character to search." : "No active cleaners found."}</p>}</div>}</div>{selectedCleanerId && <p className="text-xs text-muted-foreground">Selected cleaner: <span className="font-medium text-foreground">{search}</span></p>}<div className="flex justify-end"><Button type="button" disabled={loading || !selectedCleanerId} onClick={() => void assign()}>Assign cleaner</Button></div></>}{error && <p className="text-sm text-destructive">{error}</p>}</section>;
}

function OperationsSupport({ booking, can, onBookingChanged }: { booking: Booking; can: (...permissions: string[]) => boolean; onBookingChanged: (booking: Booking) => void }) {
  const [contacts, setContacts] = useState<Array<Record<string, unknown>>>([]);
  const [channel, setChannel] = useState<"call" | "sms" | "whatsapp">("call");
  const [outcome, setOutcome] = useState("");
  const [alarmType, setAlarmType] = useState("access_issue");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "emergency">("medium");
  const [alarmMessage, setAlarmMessage] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [requestedCleanerId, setRequestedCleanerId] = useState("none");
  const [preferredCleaners, setPreferredCleaners] = useState<CleanerCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const loadContacts = async () => { if (!can("cleaners.contact")) return; try { setContacts(await bookingsApi.contacts(booking.id)); } catch { setContacts([]); } };
  useEffect(() => { void loadContacts(); }, [booking.id]);
  useEffect(() => { if (!can("bookings.assign") || !["awaiting_assignment", "assigned"].includes(booking.status)) { setPreferredCleaners([]); return; } void bookingsApi.matches(booking.id).then(setPreferredCleaners).catch(() => setPreferredCleaners([])); }, [booking.id, booking.status]);
  const logContact = async () => {
    if (!booking.cleaner || !outcome.trim()) return;
    setBusy(true); try { setSupportError(null); await bookingsApi.logContact(booking.id, { cleaner_id: booking.cleaner.id, channel, outcome: outcome.trim() }); setOutcome(""); await loadContacts(); } catch (cause) { setSupportError(cause instanceof Error ? cause.message : "Unable to log cleaner contact."); } finally { setBusy(false); }
  };
  const raiseAlarm = async () => {
    if (!alarmMessage.trim()) return;
    setBusy(true); try { setSupportError(null); await bookingsApi.raiseAlarm(booking.id, { alarm_type: alarmType, severity, message: alarmMessage.trim() }); setAlarmMessage(""); } catch (cause) { setSupportError(cause instanceof Error ? cause.message : "Unable to raise alarm."); } finally { setBusy(false); }
  };
  const requestChange = async () => {
    if (changeReason.trim().length < 3) return;
    setBusy(true); try { setSupportError(null); const result = await bookingsApi.createCleanerChange(booking.id, { reason: changeReason.trim(), ...(requestedCleanerId !== "none" ? { requested_cleaner_id: requestedCleanerId } : {}) }); const changed = result.booking as Booking | undefined; if (changed) onBookingChanged(changed); setChangeReason(""); setRequestedCleanerId("none"); } catch (cause) { setSupportError(cause instanceof Error ? cause.message : "Unable to record cleaner-change request."); } finally { setBusy(false); }
  };
  if (!can("cleaners.contact") && !can("bookings.update") && !can("bookings.assign")) return null;
  return <section className="space-y-4 rounded-lg border p-4"><div><h3 className="font-medium">Operations support</h3><p className="text-xs text-muted-foreground">Record coordination, safety, and cleaner-change actions against this session.</p></div>
    {supportError && <p className="text-sm text-destructive">{supportError}</p>}
    {can("cleaners.contact") && booking.cleaner && <div className="space-y-2"><p className="text-sm font-medium">Cleaner contact log</p>{contacts.length > 0 && <div className="max-h-28 divide-y overflow-y-auto rounded-md border">{contacts.map((contact, index) => <div key={String(contact.id ?? index)} className="p-2 text-xs"><span className="font-medium">{String(contact.channel ?? "contact")}</span>{contact.outcome ? ` · ${String(contact.outcome)}` : ""}<span className="block text-muted-foreground">{contact.contacted_at ? new Date(String(contact.contacted_at)).toLocaleString() : "Recorded"}</span></div>)}</div>}<div className="flex flex-wrap gap-2"><Select value={channel} onValueChange={(value) => setChannel(value as typeof channel)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="call">Call</SelectItem><SelectItem value="sms">SMS</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem></SelectContent></Select><Input className="min-w-48 flex-1" value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="Outcome, e.g. confirmed arrival" /><Button type="button" size="sm" disabled={busy || !outcome.trim()} onClick={() => void logContact()}>Log contact</Button></div></div>}
    {can("bookings.assign") && <div className="space-y-2 border-t pt-4"><p className="text-sm font-medium">Cleaner-change request</p><p className="text-xs text-muted-foreground">Use this to record a customer request. Use “Change cleaner” above when the reassignment should happen now.</p><Input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Reason for the requested change" /><div className="flex flex-wrap gap-2"><Select value={requestedCleanerId} onValueChange={setRequestedCleanerId}><SelectTrigger className="min-w-52 flex-1"><SelectValue placeholder="No preferred cleaner" /></SelectTrigger><SelectContent><SelectItem value="none">No preferred cleaner</SelectItem>{preferredCleaners.map((cleaner) => <SelectItem key={cleaner.cleaner_id} value={cleaner.cleaner_id}>{cleaner.full_name} · ★ {cleaner.rating ?? "—"} · {cleaner.current_assignments} jobs</SelectItem>)}</SelectContent></Select><Button type="button" size="sm" variant="outline" disabled={busy || changeReason.trim().length < 3} onClick={() => void requestChange()}>Record request</Button></div></div>}
    {can("bookings.update") && <div className="space-y-2 border-t pt-4"><p className="text-sm font-medium">Raise operational alarm</p><div className="grid gap-2 sm:grid-cols-3"><Input value={alarmType} onChange={(event) => setAlarmType(event.target.value)} placeholder="Alarm type" /><Select value={severity} onValueChange={(value) => setSeverity(value as typeof severity)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="emergency">Emergency</SelectItem></SelectContent></Select><Button type="button" variant="destructive" disabled={busy || !alarmMessage.trim()} onClick={() => void raiseAlarm()}>Raise alarm</Button></div><Input value={alarmMessage} onChange={(event) => setAlarmMessage(event.target.value)} placeholder="Describe the access, safety, or service issue" /></div>}
  </section>;
}

function CreateBookingDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [customers, setCustomers] = useState<ApiUser[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customer, setCustomer] = useState<ApiUser | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [propertyTypeId, setPropertyTypeId] = useState("");
  const [propertyDetails, setPropertyDetails] = useState<Record<string, unknown>>({});
  const [addons, setAddons] = useState<Record<string, number>>({});
  const [form, setForm] = useState(emptyBookingForm);
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
  const [quoteSignature, setQuoteSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const bookingServices = useMemo(() => services.flatMap((service) => [service, ...service.sub_services]), [services]);
  const selectedService = useMemo(() => bookingServices.find((service) => service.id === serviceId) ?? null, [bookingServices, serviceId]);
  const selectedPackage = useMemo(() => selectedService?.packages.find((item) => item.id === packageId) ?? null, [selectedService, packageId]);
  const selectedPropertyType = useMemo(() => propertyTypes.find((item) => item.id === propertyTypeId) ?? null, [propertyTypes, propertyTypeId]);
  const isRecurring = Boolean(selectedPackage && selectedPackage.billing_cycle !== "one_time");
  const selectedAddons = () => Object.entries(addons).filter(([, quantity]) => quantity > 0).map(([additional_service_id, quantity]) => ({ additional_service_id, quantity }));
  const pricingPayload = () => ({
    service_type_id: serviceId, service_package_id: packageId, property_type_id: propertyTypeId, property_details: propertyDetails,
    ...(selectedAddons().length ? { additional_services: selectedAddons() } : {}),
  });
  const currentQuoteSignature = () => JSON.stringify(pricingPayload());
  const missingPropertyFields = selectedPropertyType?.fields.filter((field) => field.required && (propertyDetails[field.key] === undefined || propertyDetails[field.key] === "")) ?? [];
  const quoteIsCurrent = Boolean(quote && quoteSignature === currentQuoteSignature());
  const reset = () => { setCustomerQuery(""); setCustomer(null); setCustomers([]); setServiceId(""); setPackageId(""); setPropertyTypeId(""); setPropertyDetails({}); setAddons({}); setForm(emptyBookingForm); setQuote(null); setQuoteSignature(""); setError(null); };
  useEffect(() => {
    if (!open) return;
    setLoadingCatalog(true);
    Promise.all([servicesApi.list(), bookingsApi.propertyTypes()]).then(([catalog, types]) => { setServices(catalog); setPropertyTypes(types); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load booking form data.")).finally(() => setLoadingCatalog(false));
  }, [open]);
  useEffect(() => {
    if (customerQuery.trim().length < 2 || customer?.full_name === customerQuery) { setCustomers([]); return; }
    const timer = window.setTimeout(() => { void usersApi.list("customer", customerQuery).then(setCustomers).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to search customers.")); }, 300);
    return () => window.clearTimeout(timer);
  }, [customerQuery, customer]);
  const calculateQuote = async () => {
    if (!serviceId || !packageId || !propertyTypeId) { setError("Select a service, package, and property type before calculating a quote."); return; }
    if (missingPropertyFields.length) { setError(`Complete required property field${missingPropertyFields.length === 1 ? "" : "s"}: ${missingPropertyFields.map((field) => field.label).join(", ")}.`); return; }
    try { setError(null); setQuote(await bookingsApi.quote(pricingPayload())); setQuoteSignature(currentQuoteSignature()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to calculate the quote."); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!customer || !serviceId || !packageId || !form.scheduled_for || !propertyTypeId) { setError("Select a customer, service, package, property type, and future appointment time."); return; }
    if (missingPropertyFields.length) { setError(`Complete required property field${missingPropertyFields.length === 1 ? "" : "s"}: ${missingPropertyFields.map((field) => field.label).join(", ")}.`); return; }
    if (!quoteIsCurrent) { setError("Calculate a current quote before creating this booking."); return; }
    if (form.address_mode === "saved" && !form.saved_address_id.trim()) { setError("Enter the customer's saved address ID, or switch to an inline address."); return; }
    if (form.address_mode === "inline" && (!form.address_line.trim() || !form.latitude || !form.longitude)) { setError("An inline address needs the address, latitude, and longitude."); return; }
    setSaving(true);
    try {
      const payload = { customer_id: customer.id, ...pricingPayload(), scheduled_for: new Date(form.scheduled_for).toISOString(), ...(form.special_instructions ? { special_instructions: form.special_instructions } : {}), ...(form.additional_notes ? { additional_notes: form.additional_notes } : {}), ...(isRecurring && form.recurrence_end_date ? { recurrence_end_date: form.recurrence_end_date } : {}), ...(isRecurring && form.session_days ? { session_days_of_month: form.session_days.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 1 && value <= 28) } : {}), ...(form.address_mode === "saved" ? { saved_address_id: form.saved_address_id.trim() } : { address_line: form.address_line.trim(), city: form.city.trim() || undefined, latitude: Number(form.latitude), longitude: Number(form.longitude) }) };
      await bookingsApi.create(payload); onOpenChange(false); reset(); onCreated();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create booking."); } finally { setSaving(false); }
  };
  const staleQuote = () => { setQuote(null); setQuoteSignature(""); };
  return <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Create staff-assisted booking</DialogTitle></DialogHeader>
    <form noValidate onSubmit={submit} className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <section className="space-y-3"><h3 className="font-medium">1. Customer</h3><div className="relative"><Label>Find active customer</Label><Input className="mt-1" value={customerQuery} onChange={(event) => { setCustomer(null); setCustomerQuery(event.target.value); }} placeholder="Search by name, email, or phone" />{customers.length > 0 && <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">{customers.map((item) => <button key={item.id} type="button" className="w-full rounded p-2 text-left text-sm hover:bg-muted" onClick={() => { setCustomer(item); setCustomerQuery(item.full_name); setCustomers([]); }}><span className="font-medium">{item.full_name}</span><span className="ml-2 text-muted-foreground">{item.email ?? item.phone ?? ""}</span></button>)}</div>}</div>{customer && <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm"><b>{customer.full_name}</b> · {customer.email ?? customer.phone ?? "No contact details"}</div>}</section>
      <section className="space-y-3"><h3 className="font-medium">2. Service and package</h3><div className="grid gap-4 sm:grid-cols-2"><Field label="Service"><select disabled={loadingCatalog} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={serviceId} onChange={(event) => { setServiceId(event.target.value); setPackageId(""); setAddons({}); staleQuote(); }}><option value="">{loadingCatalog ? "Loading services…" : "Select service"}</option>{bookingServices.filter((item) => item.is_active !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{!loadingCatalog && !bookingServices.length && <p className="mt-1 text-xs text-destructive">No services are available. Refresh the catalogue and try again.</p>}</Field><Field label="Package"><select disabled={!selectedService || loadingCatalog} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={packageId} onChange={(event) => { setPackageId(event.target.value); staleQuote(); }}><option value="">Select package</option>{selectedService?.packages.filter((item) => item.is_active !== false).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currency} {Number(item.price).toLocaleString()} ({item.billing_cycle.replaceAll("_", " ")})</option>)}</select></Field></div>{selectedService && <div><Label>Add-ons</Label><div className="mt-2 grid gap-2 sm:grid-cols-2">{selectedService.additional_services.filter((item) => item.is_active !== false).map((item) => <div className="flex items-center justify-between rounded-md border p-3" key={item.id}><div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.currency} {Number(item.rate).toLocaleString()} {item.applies_per_session ? "per session" : "once"}</p></div><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => { setAddons({ ...addons, [item.id]: Math.max(0, (addons[item.id] ?? 0) - 1) }); staleQuote(); }}>−</Button><span>{addons[item.id] ?? 0}</span><Button type="button" variant="outline" size="sm" disabled={(addons[item.id] ?? 0) >= (item.maximum_quantity ?? 100)} onClick={() => { setAddons({ ...addons, [item.id]: (addons[item.id] ?? 0) + 1 }); staleQuote(); }}>+</Button></div></div>)}</div></div>}</section>
      <section className="space-y-3"><h3 className="font-medium">3. Schedule, property, and address</h3><div className="grid gap-4 sm:grid-cols-2"><Field label="Date and time"><Input required type="datetime-local" value={form.scheduled_for} onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })} /></Field><Field label="Property type"><select required disabled={loadingCatalog} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60" value={propertyTypeId} onChange={(event) => { setPropertyTypeId(event.target.value); setPropertyDetails({}); staleQuote(); }}><option value="">{loadingCatalog ? "Loading property types…" : "Select property type"}</option>{propertyTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>{selectedPropertyType?.fields.map((field) => <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}`}>{field.type === "select" ? <select required={field.required} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={String(propertyDetails[field.key] ?? "")} onChange={(event) => { setPropertyDetails({ ...propertyDetails, [field.key]: event.target.value }); staleQuote(); }}><option value="">Select {field.label}</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === "boolean" ? <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm"><input type="checkbox" checked={Boolean(propertyDetails[field.key])} onChange={(event) => { setPropertyDetails({ ...propertyDetails, [field.key]: event.target.checked }); staleQuote(); }} />{field.label}</label> : <Input required={field.required} type={field.type === "number" ? "number" : "text"} min={field.type === "number" ? "0" : undefined} value={String(propertyDetails[field.key] ?? "")} onChange={(event) => { const value = field.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value; setPropertyDetails({ ...propertyDetails, [field.key]: value }); staleQuote(); }} />}</Field>)}</div>{!loadingCatalog && !propertyTypes.length && <p className="rounded-md border border-dashed p-3 text-sm text-destructive">No active property types are available. An administrator must create and activate one before a booking can be quoted.</p>}
      {isRecurring && <div className="grid gap-4 rounded-md border bg-muted/30 p-4 sm:grid-cols-2"><Field label="Monthly visit days"><Input placeholder="e.g. 1, 15 (only for monthly plans)" value={form.session_days} onChange={(event) => setForm({ ...form, session_days: event.target.value })} /></Field><Field label="Recurrence end date"><Input type="date" value={form.recurrence_end_date} onChange={(event) => setForm({ ...form, recurrence_end_date: event.target.value })} /></Field><p className="sm:col-span-2 text-xs text-muted-foreground">This package is recurring. The server creates the later session records; the first session time above is retained.</p></div>}
      <div className="flex gap-2"><Button type="button" size="sm" variant={form.address_mode === "inline" ? "default" : "outline"} onClick={() => setForm({ ...form, address_mode: "inline" })}>Inline address</Button><Button type="button" size="sm" variant={form.address_mode === "saved" ? "default" : "outline"} onClick={() => setForm({ ...form, address_mode: "saved" })}>Saved address</Button></div>{form.address_mode === "saved" ? <Field label="Customer saved address ID"><Input value={form.saved_address_id} onChange={(event) => setForm({ ...form, saved_address_id: event.target.value })} placeholder="Saved address UUID" /><p className="text-xs text-muted-foreground">Use the address ID from the customer’s saved-address record. It cannot be combined with an inline address.</p></Field> : <div className="space-y-3"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Address line"><Input value={form.address_line} onChange={(event) => setForm({ ...form, address_line: event.target.value })} placeholder="Street, building, and neighbourhood" /></Field></div><Field label="City"><Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Nairobi" /></Field></div><LocationPicker latitude={form.latitude} longitude={form.longitude} city={form.city} address={form.address_line} onChange={(val: LocationPickerValue) => setForm({ ...form, latitude: val.latitude != null ? String(val.latitude) : "", longitude: val.longitude != null ? String(val.longitude) : "", city: val.city || form.city, address_line: val.address || form.address_line })} label="Booking Location & Coordinates" placeholder="Search address or landmark on Google Maps…" /></div>}<div className="grid gap-4 sm:grid-cols-2"><Field label="Special instructions"><Input value={form.special_instructions} onChange={(event) => setForm({ ...form, special_instructions: event.target.value })} placeholder="Call on arrival" /></Field><Field label="Internal notes"><Input value={form.additional_notes} onChange={(event) => setForm({ ...form, additional_notes: event.target.value })} placeholder="Parking or access notes" /></Field></div></section>
      <section className="rounded-md border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-medium">Server-generated quote</h3><p className="text-sm text-muted-foreground">Pricing is calculated by the booking service and locked when this session is created.</p></div><Button type="button" variant="outline" onClick={() => void calculateQuote()}>Calculate quote</Button></div>{quote && <div className="mt-4 space-y-4 text-sm"><div className="grid gap-3 sm:grid-cols-4"><QuoteItem label="Base price" value={`${quote.currency ?? ""} ${Number(quote.base_price ?? 0).toLocaleString()}`} /><QuoteItem label="Package total" value={`${quote.currency ?? ""} ${Number(quote.package_total ?? quote.base_price ?? 0).toLocaleString()}`} /><QuoteItem label="Add-ons" value={`${quote.currency ?? ""} ${Number(quote.additional_services_total ?? 0).toLocaleString()}`} /><QuoteItem label="Total per session" value={`${quote.currency ?? ""} ${Number(quote.total_price ?? 0).toLocaleString()}`} /></div><div className="rounded-md bg-muted/60 p-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Calculation</p><p className="mt-1">{String(quote.calculation ?? quote.calculation_explanation ?? "Server quote ready.")}</p></div>{Array.isArray(quote.additional_service_items) && quote.additional_service_items.length > 0 && <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add-on calculation</p><div className="divide-y rounded-md border">{(quote.additional_service_items as Array<Record<string, unknown>>).map((item) => <div key={String(item.additional_service_id)} className="flex flex-wrap items-center justify-between gap-2 p-3"><div><p className="font-medium">{String(item.name ?? "Add-on")}</p><p className="text-xs text-muted-foreground">{Number(item.quantity ?? 1)} × {String(item.currency ?? quote.currency ?? "")} {Number(item.unit_rate ?? 0).toLocaleString()}{item.applies_per_session ? " per session" : ""}{Number(item.charged_sessions ?? 1) > 1 ? ` × ${Number(item.charged_sessions)} sessions` : ""}</p></div><p className="font-medium">{String(item.currency ?? quote.currency ?? "")} {Number(item.total_price ?? 0).toLocaleString()}</p></div>)}</div></div>}{Boolean(quote.is_recurring) && <p className="text-xs text-muted-foreground">Recurring package: {String(quote.visits_per_cycle ?? 1)} visit(s) per cycle for {String(quote.commitment_cycles ?? "—")} cycle(s).</p>}</div>}</section>
      <div className="border-t pt-4"><p className="mb-3 text-xs text-muted-foreground">Before creating: select a customer, service, package, future session time, property type, complete its required fields, calculate a current quote, and provide either a saved address or an inline address with latitude and longitude.</p>{error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving || !quoteIsCurrent}>{saving ? "Creating…" : isRecurring ? "Create plan and sessions" : "Create booking"}</Button></div></div>
    </form>
  </DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>; }
function QuoteItem({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>; }
