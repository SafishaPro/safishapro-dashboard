import { useEffect, useRef, useState } from "react";
import { bookingsApi, paymentsApi, type Booking, type Payment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Props = { booking: Booking; can: (...permissions: string[]) => boolean; onBookingChanged: (booking: Booking) => void };
const isOpen = (p: Payment) => ["initiated", "pending"].includes(p.status);
const normalizePhone = (value: string) => value.replace(/[\s+-]/g, "").replace(/^0/, "254");
const messageOf = (error: unknown) => error instanceof Error ? error.message : "Unable to complete the request.";

export function BookingPaymentPanel({ booking, can, onBookingChanged }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [phone, setPhone] = useState("");
  const [receipt, setReceipt] = useState("");
  const [note, setNote] = useState("");
  const [verificationKey, setVerificationKey] = useState("");
  const canRead = can("payments.read");

  const readPayments = async () => {
    setLoaded(false);
    const rows = await paymentsApi.list({ booking_id: booking.id, limit: 200 });
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    setPayments(rows);
    setLoaded(true);
    return rows;
  };
  useEffect(() => {
    if (!canRead) return;
    let active = true;
    paymentsApi.list({ booking_id: booking.id, limit: 200 }).then((rows) => {
      if (active) { setPayments(rows.sort((a, b) => b.created_at.localeCompare(a.created_at))); setLoaded(true); }
    }).catch((cause) => { if (active) setError(messageOf(cause)); });
    return () => { active = false; };
  }, [booking.id, canRead]);

  const latest = payments[0];
  const open = payments.find(isOpen);
  const payable = ["pending", "awaiting_payment", "payment_failed"].includes(booking.status);
  const eligible = (rows: Payment[]) => {
    return payable && rows.every((p) =>
      ["failed", "timed_out"].includes(p.status) && !p.reconciliation_required);
  };
  const canRetry = loaded && eligible(payments) && can("payments.update");
  const blockedReason = !can("payments.update")
    ? "You need payments.update permission to send an STK prompt."
    : !loaded ? "Load payment history before sending a prompt."
    : open ? "An existing payment is still awaiting confirmation. Check M-Pesa status first; a second prompt cannot be sent while it is open."
    : payments.some((p) => p.reconciliation_required) ? "A previous payment needs reconciliation before another prompt can be sent."
    : payments.some((p) => p.status === "successful") ? "A successful payment is already recorded for this booking."
    : !eligible(payments) ? "The previous payment must be confirmed failed or timed out before retrying."
    : null;
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setNotice(null);
    try { await action(); }
    catch (cause) { setError(messageOf(cause)); }
    finally { lock.current = false; setBusy(false); }
  };
  const reload = () => run(async () => { await readPayments(); onBookingChanged(await bookingsApi.get(booking.id)); });
  const checkStatus = () => run(async () => {
    const target = open ?? latest;
    if (!target) return;
    const result = await paymentsApi.refresh(target.id);
    setNotice(result.status === "successful" && !result.reconciliation_required
      ? "Payment verified." : result.result_description || `Payment is ${result.status.replaceAll("_", " ")}.`);
    await readPayments(); onBookingChanged(await bookingsApi.get(booking.id));
  });
  const retry = () => run(async () => {
    const number = normalizePhone(phone);
    if (!/^254[17]\d{8}$/.test(number)) throw new Error("Enter a valid Kenyan M-Pesa phone number.");
    // Re-read before sending; the backend also locks the booking and rejects open attempts.
    const rows = await readPayments();
    if (!eligible(rows)) { setRetrying(false); throw new Error("Payment status changed. Review the latest attempt before retrying."); }
    setRetrying(false);
    setLoaded(false);
    try {
      const result = await paymentsApi.retryStk(booking.id, number);
      setPayments((previous) => [result, ...previous.filter((p) => p.id !== result.id)]);
      setNotice(["failed", "timed_out"].includes(result.status)
        ? result.failure_reason || result.result_description || "The STK request was rejected."
        : result.status === "successful" ? "Payment verified." : "STK attempt recorded. Awaiting customer confirmation; do not send another prompt.");
    } catch (cause) {
      setError(`${messageOf(cause)} Reload payment history before taking another action; the request may have reached M-Pesa.`);
    }
    // Never automatically resend a charge after a network error.
    await readPayments(); onBookingChanged(await bookingsApi.get(booking.id));
  });
  const markPaid = () => run(async () => {
    await paymentsApi.markBookingPaid(booking.id, { receipt_number: receipt.trim(), note: note.trim() || undefined, idempotency_key: verificationKey });
    setVerificationKey(""); await readPayments(); onBookingChanged(await bookingsApi.get(booking.id));
  });

  if (!canRead) return <section className="space-y-2 rounded-lg border p-4"><h3 className="font-medium">Payment</h3>{payable && <Button type="button" disabled>Initiate / re-initiate STK push</Button>}<p className="text-sm text-muted-foreground">You need payments.read permission to view payment history and safely initiate payments.</p></section>;
  return <section className="space-y-3 rounded-lg border p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium">Payment</h3><p className="text-xs text-muted-foreground">Verified payments release the booking for assignment.</p></div><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void reload()}>Reload history</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {!loaded && !error && <p className="text-sm text-muted-foreground">Loading payment history…</p>}
    {loaded && !payments.length && <p className="text-sm text-muted-foreground">No payment attempt has been created yet.</p>}
    {payments.map((p) => <div key={p.id} className="space-y-1 rounded-md bg-muted/60 p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{p.currency} {Number(p.amount).toLocaleString()} · {p.provider}{p.gateway_environment ? ` · ${p.gateway_environment}` : ""}</span><Badge variant={p.status === "successful" && !p.reconciliation_required ? "success" : ["failed", "timed_out"].includes(p.status) ? "destructive" : "secondary"}>{p.status.replaceAll("_", " ")}</Badge></div>
      <p className="text-xs text-muted-foreground">{p.phone_number || "No payer phone"} · {new Date(p.created_at).toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{p.receipt_number ? `Receipt: ${p.receipt_number}` : "No receipt recorded"}</p>
      {(p.failure_reason || p.result_description) && <p>{p.failure_reason || p.result_description}</p>}
      {p.reconciliation_required && <p className="font-medium">Needs review — verify this attempt before requesting another payment.</p>}
    </div>)}
    {!retrying && (payable || ((open ?? latest)?.provider === "mpesa" && (open ?? latest)?.payment_channel !== "c2b")) && <div className="flex flex-wrap items-center gap-2">
      {(open ?? latest)?.provider === "mpesa" && (open ?? latest)?.payment_channel !== "c2b" && <Button type="button" variant="outline" disabled={busy} onClick={() => void checkStatus()}>{busy ? "Please wait…" : "Check M-Pesa status"}</Button>}
      {payable && <Button type="button" disabled={busy || !canRetry} onClick={() => { setPhone(latest?.phone_number || ""); setRetrying(true); }}>{payments.length ? "Re-initiate STK push" : "Initiate STK push"}</Button>}
    </div>}
    {blockedReason && payable && !retrying && <p className="text-sm text-muted-foreground">{blockedReason}</p>}
    {open?.provider === "mpesa" && <p className="text-xs text-muted-foreground">This attempt is still open. Check status before sending another prompt. Provider checks are limited to once per minute.</p>}
    {retrying && canRetry && <div className="space-y-3 rounded-md border p-3">
      <h4 className="text-sm font-medium">Send a new M-Pesa prompt</h4>
      <p className="text-sm">{booking.currency} {Number(booking.quoted_price).toLocaleString()} will be requested. Wallet credit will not be used. Any earlier attempts remain in history.</p>
      <Label htmlFor={`stk-phone-${booking.id}`}>Customer M-Pesa phone</Label><Input id={`stk-phone-${booking.id}`} type="tel" autoComplete="tel" value={phone} disabled={busy} onChange={(event) => setPhone(event.target.value)} placeholder="0712345678" />
      {latest?.gateway_environment === "production" && <p className="text-xs text-muted-foreground">Production payment: customer authorization transfers real money.</p>}
      <div className="flex gap-2"><Button type="button" disabled={busy || !/^254[17]\d{8}$/.test(normalizePhone(phone))} onClick={() => void retry()}>{busy ? "Sending…" : "Confirm and send STK"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setRetrying(false)}>Cancel</Button></div>
    </div>}
    {loaded && can("payments.verify") && booking.status === "awaiting_payment" && open?.provider === "simulated" && <div className="space-y-2 border-t pt-3">
      {!verificationKey ? <Button type="button" disabled={busy} onClick={() => { setReceipt(""); setNote(""); setVerificationKey(`mark-paid-${booking.id}-${crypto.randomUUID()}`); }}>Mark as paid</Button> : <><Label>Receipt or bank reference</Label><Input value={receipt} onChange={(e) => setReceipt(e.target.value)} /><Label>Internal note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /><Button type="button" disabled={busy || receipt.trim().length < 3} onClick={() => void markPaid()}>Confirm payment</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setVerificationKey("")}>Cancel</Button></>}
    </div>}
  </section>;
}
