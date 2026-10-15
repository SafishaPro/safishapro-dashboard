import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Clock3, CreditCard, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { paymentsApi, type Payment } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_dash/payments")({ component: PaymentsPage });
const paymentVariant = (status: string) => status === "successful" ? "success" : ["failed", "timed_out", "reversed", "refunded"].includes(status) ? "destructive" : "secondary";
const formatPaymentDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("month")} ${part("day")}, ${part("year")} · ${part("hour")}:${part("minute")} ${part("dayPeriod").toUpperCase()}`;
};

function PaymentsPage() {
  const { can } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestSequence = useRef(0);

  const load = async () => {
    if (!can("payments.read")) return;
    if (search.trim().length === 1) {
      requestSequence.current += 1;
      setPayments([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError("Start date cannot be after end date.");
      return;
    }
    const requestId = ++requestSequence.current;
    try {
      setLoading(true);
      setError(null);
      const rows = await paymentsApi.list({
        status: status === "all" ? undefined : status,
        method: method === "all" ? undefined : method as "simulated" | "mpesa",
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search.trim().length >= 2 ? search.trim() : undefined,
        limit: 200,
      });
      if (requestId === requestSequence.current) setPayments(rows);
    } catch (cause) {
      if (requestId === requestSequence.current) setError(cause instanceof Error ? cause.message : "Unable to load payments.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (search.trim().length === 1) {
      requestSequence.current += 1;
      setPayments([]);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => { void load(); }, search.trim().length >= 2 ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [search]);

  const summary = useMemo(() => {
    const totalFor = (matches: (payment: Payment) => boolean) => {
      const rows = payments.filter(matches);
      return {
        count: rows.length,
        amount: rows.reduce((total, payment) => total + Number(payment.amount || 0), 0),
        currency: rows[0]?.currency ?? payments[0]?.currency ?? "KES",
      };
    };
    return {
      pending: totalFor((payment) => ["initiated", "pending"].includes(payment.status)),
      successful: totalFor((payment) => payment.status === "successful"),
      failed: totalFor((payment) => payment.status === "failed"),
      timedOut: totalFor((payment) => payment.status === "timed_out"),
    };
  }, [payments]);

  if (!can("payments.read")) return <div className="text-sm text-muted-foreground">You do not have permission to view customer payments.</div>;

  const resetFilters = () => {
    setStatus("all");
    setMethod("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setLoading(true);
    setError(null);
    const requestId = ++requestSequence.current;
    void paymentsApi.list({ limit: 200 }).then((rows) => { if (requestId === requestSequence.current) setPayments(rows); }).catch((cause) => { if (requestId === requestSequence.current) setError(cause instanceof Error ? cause.message : "Unable to load payments."); }).finally(() => { if (requestId === requestSequence.current) setLoading(false); });
  };

  return <div className="space-y-6">
    <PageHeader title="Customer payments" description="Review payment attempts, M-Pesa receipts, and collected amounts." actions={<Button variant="outline" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>} />

    {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p></div>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard icon={<CircleCheck className="h-4 w-4" />} label="Successful" value={`${summary.successful.currency} ${summary.successful.amount.toLocaleString()}`} hint={`${summary.successful.count.toLocaleString()} payment${summary.successful.count === 1 ? "" : "s"}`} tone="success" />
      <SummaryCard icon={<Clock3 className="h-4 w-4" />} label="Pending" value={`${summary.pending.currency} ${summary.pending.amount.toLocaleString()}`} hint={`${summary.pending.count.toLocaleString()} payment${summary.pending.count === 1 ? "" : "s"}`} tone="pending" />
      <SummaryCard icon={<Clock3 className="h-4 w-4" />} label="Timed out" value={`${summary.timedOut.currency} ${summary.timedOut.amount.toLocaleString()}`} hint={`${summary.timedOut.count.toLocaleString()} payment${summary.timedOut.count === 1 ? "" : "s"}`} tone="timeout" />
      <SummaryCard icon={<CircleAlert className="h-4 w-4" />} label="Failed" value={`${summary.failed.currency} ${summary.failed.amount.toLocaleString()}`} hint={`${summary.failed.count.toLocaleString()} payment${summary.failed.count === 1 ? "" : "s"}`} tone="attention" />
    </div>

    <Card className="overflow-hidden">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">Filter payments</h2>
        <p className="mt-1 text-sm text-muted-foreground">Narrow the list by payment result, provider, or date.</p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] xl:items-end">
        <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Payment status</label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{["initiated", "pending", "successful", "failed", "timed_out", "reversed", "refunded"].map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Provider</label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All providers</SelectItem><SelectItem value="mpesa">M-Pesa</SelectItem><SelectItem value="simulated">Simulated</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">From</label><Input aria-label="Payment start date" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} /></div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">To</label><Input aria-label="Payment end date" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></div>
        <Button onClick={() => void load()} disabled={loading}>Apply filters</Button>
        <Button variant="ghost" onClick={resetFilters} disabled={loading}>Reset</Button>
      </div>
    </Card>

    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1"><h2 className="font-semibold">Payment history</h2><p className="mt-1 text-sm text-muted-foreground">Payment identifiers, customer, receipt, and amount.</p><div className="relative mt-4 max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" aria-label="Search by invoice number, customer name, or payment reference" placeholder="Search invoice number, customer name, or payment reference…" value={search} onChange={(event) => { requestSequence.current += 1; setSearch(event.target.value); setError(null); setLoading(true); }} /></div>{search.trim().length === 1 && <p className="mt-2 text-xs text-muted-foreground">Enter at least 2 characters to search.</p>}</div>
        <Badge variant="outline" className="rounded-full px-3 py-1">{loading ? "Searching…" : `${payments.length} records`}</Badge>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="bg-muted/40"><TableHead className="w-14">#</TableHead><TableHead className="whitespace-nowrap">Payment date</TableHead><TableHead>Customer</TableHead><TableHead>Payment reference</TableHead><TableHead>Invoice no.</TableHead><TableHead>Provider</TableHead><TableHead>Receipt</TableHead><TableHead>Payment status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {payments.map((payment, index) => <TableRow key={payment.id}>
              <TableCell className="w-14 font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</TableCell>
              <TableCell className="min-w-44 whitespace-nowrap text-sm text-muted-foreground">{formatPaymentDate(payment.initiated_at || payment.created_at)}</TableCell>
              <TableCell className="min-w-36 font-medium">{payment.customer_name || "—"}</TableCell>
              <TableCell className="min-w-36 font-mono text-xs">{payment.payment_number || payment.id.slice(0, 8).toUpperCase()}</TableCell>
              <TableCell className="min-w-32 font-mono text-xs">{payment.booking_invoice || "—"}</TableCell>
              <TableCell className="capitalize">{payment.provider || "—"}</TableCell>
              <TableCell className="min-w-28 font-mono text-xs">{payment.receipt_number || "—"}</TableCell>
              <TableCell><Badge variant={paymentVariant(payment.status)} className="capitalize">{payment.status.replaceAll("_", " ")}</Badge></TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold">{payment.currency} {Number(payment.amount).toLocaleString()}</TableCell>
            </TableRow>)}
            {!loading && !payments.length && <TableRow><TableCell colSpan={9} className="h-40 text-center"><div className="mx-auto flex max-w-sm flex-col items-center gap-2"><div className="rounded-full bg-muted p-3"><CreditCard className="h-5 w-5 text-muted-foreground" /></div><p className="font-medium">No payments found</p><p className="text-sm text-muted-foreground">Try a different search or adjust the payment filters.</p></div></TableCell></TableRow>}
            {loading && !payments.length && <TableRow><TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground">Loading payments…</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </Card>
  </div>;
}

function SummaryCard({ icon, label, value, hint, tone = "default" }: { icon: React.ReactNode; label: string; value: string; hint: string; tone?: "default" | "success" | "pending" | "attention" | "timeout" }) {
  const cardToneClass = tone === "success" ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25" : tone === "pending" ? "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25" : tone === "attention" ? "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/25" : tone === "timeout" ? "border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/25" : "border-primary/20 bg-primary/5";
  const iconToneClass = tone === "success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300" : tone === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300" : tone === "attention" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-300" : tone === "timeout" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/70 dark:text-sky-300" : "bg-primary/10 text-primary";
  return <Card className={`min-h-36 p-5 shadow-sm ${cardToneClass}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-3 break-words text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">{value}</p></div><span className={`rounded-lg p-2 ${iconToneClass}`}>{icon}</span></div><p className="mt-3 text-sm text-muted-foreground">{hint}</p></Card>;
}
