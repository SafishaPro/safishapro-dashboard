import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { monitoringApi, type AuditLog, type OtpLog, type OtpSummary } from "@/lib/api";

export const Route = createFileRoute("/_dash/audit")({ component: AuditPage });

function AuditPage() {
  const { can } = useAuth();
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [otp, setOtp] = useState<OtpLog[]>([]);
  const [summary, setSummary] = useState<OtpSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try {
      const [auditLogs, otpLogs, otpSummary] = await Promise.all([
        can("audit_logs.read") ? monitoringApi.auditLogs({ limit: 100 }) : Promise.resolve([]),
        can("otp_logs.read") ? monitoringApi.otpLogs(100) : Promise.resolve([]),
        can("otp_logs.read") ? monitoringApi.otpSummary() : Promise.resolve(null),
      ]);
      setAudit(auditLogs); setOtp(otpLogs); setSummary(otpSummary);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load monitoring data."); }
  };
  useEffect(() => { load(); }, []);

  return <div className="space-y-6">
    <PageHeader title="Audit & OTP Monitoring" description="Administrative activity and OTP metadata. This is not a complete login history." actions={<Button variant="outline" onClick={load}>Refresh</Button>} />
    {error && <p className="text-sm text-destructive">{error}</p>}
    {summary && <div className="grid gap-3 sm:grid-cols-5">{Object.entries(summary).map(([label, value]) => <Card key={label} className="p-4"><div className="text-xs text-muted-foreground capitalize">{label.replace("_", " ")}</div><div className="text-2xl font-semibold">{value}</div></Card>)}</div>}
    {can("otp_logs.read") && <section className="space-y-3"><h2 className="font-semibold">Recent OTP metadata</h2><Card className="overflow-hidden p-0">{otp.length ? <Table><TableHeader><TableRow><TableHead>Phone number</TableHead><TableHead>OTP</TableHead><TableHead>Attempts</TableHead><TableHead>Expires at</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader><TableBody>{otp.map((entry) => { const active = entry.state === "active" && !entry.consumed; return <TableRow key={entry.id}><TableCell className="font-medium">{entry.phone}</TableCell><TableCell className="font-mono font-semibold tracking-wider text-blue-900">{entry.otp ?? "—"}</TableCell><TableCell>{entry.attempts}</TableCell><TableCell className="text-muted-foreground">{new Date(entry.expires_at).toLocaleString()}</TableCell><TableCell className="text-right"><Badge variant={active ? "success" : "destructive"}>{active ? "Active" : "Inactive"}</Badge></TableCell></TableRow>; })}</TableBody></Table> : <p className="p-4 text-sm text-muted-foreground">No OTP metadata was returned.</p>}</Card></section>}
    {can("audit_logs.read") && <section className="space-y-3"><h2 className="font-semibold">Administrative activity</h2><Card className="divide-y p-0">{audit.length ? audit.map((event) => <div key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"><span className="font-medium">{event.action}</span><span className="text-muted-foreground">by {event.actor_email ?? "System"}</span><span className="text-muted-foreground">· {event.target_type}</span><span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span></div>) : <p className="p-4 text-sm text-muted-foreground">No administrative activity in the current API window.</p>}</Card></section>}
  </div>;
}
