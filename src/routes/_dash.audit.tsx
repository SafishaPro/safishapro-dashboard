import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { monitoringApi, type AuditLog, type OtpLog, type OtpSummary } from "@/lib/api";

export const Route = createFileRoute("/_dash/audit")({ component: AuditPage });

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const dateTime = (value: string) => new Date(value).toLocaleString();
const escapeHtml = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const fileDate = () => new Date().toISOString().slice(0, 10);
const LOGS_PER_PAGE = 25;

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function LogPagination({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / LOGS_PER_PAGE));
  if (total <= LOGS_PER_PAGE) return null;
  const first = (page - 1) * LOGS_PER_PAGE + 1;
  const last = Math.min(page * LOGS_PER_PAGE, total);
  return <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
    <span>Showing {first}–{last} of {total} records</span>
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="size-4" />Previous</Button>
      <span className="whitespace-nowrap text-xs">Page {page} of {pageCount}</span>
      <Button type="button" variant="outline" size="sm" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>Next<ChevronRight className="size-4" /></Button>
    </div>
  </div>;
}

function AuditPage() {
  const { can } = useAuth();
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [otp, setOtp] = useState<OtpLog[]>([]);
  const [summary, setSummary] = useState<OtpSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [otpPage, setOtpPage] = useState(1);
  const canExportAudit = can("audit_logs.read", "audit_logs.export");
  const canExportOtp = can("otp_logs.read", "otp_logs.export");
  const canExport = (canExportAudit && audit.length > 0) || (canExportOtp && otp.length > 0);
  const load = async () => {
    setError(null);
    try {
      const [auditLogs, otpLogs, otpSummary] = await Promise.all([
        can("audit_logs.read") ? monitoringApi.auditLogs({ limit: 500 }) : Promise.resolve([]),
        can("otp_logs.read") ? monitoringApi.otpLogs(500) : Promise.resolve([]),
        can("otp_logs.read") ? monitoringApi.otpSummary() : Promise.resolve(null),
      ]);
      setAudit(auditLogs); setOtp(otpLogs); setSummary(otpSummary); setAuditPage(1); setOtpPage(1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load monitoring data."); }
  };
  useEffect(() => { void load(); }, []);

  const auditPageCount = Math.max(1, Math.ceil(audit.length / LOGS_PER_PAGE));
  const otpPageCount = Math.max(1, Math.ceil(otp.length / LOGS_PER_PAGE));
  const visibleAudit = audit.slice((auditPage - 1) * LOGS_PER_PAGE, auditPage * LOGS_PER_PAGE);
  const visibleOtp = otp.slice((otpPage - 1) * LOGS_PER_PAGE, otpPage * LOGS_PER_PAGE);

  const exportCsv = () => {
    const rows = [
      ["Report", "Record type", "Timestamp", "Action / state", "Actor / phone", "Target / OTP", "Status", "Details"],
      ...(canExportAudit ? audit.map((event) => ["Audit & OTP Monitoring", "Administrative activity", dateTime(event.created_at), event.action, event.actor_email ?? "System", event.target_type, event.target_id ?? "", JSON.stringify(event.details)]) : []),
      ...(canExportOtp ? otp.map((entry) => ["Audit & OTP Monitoring", "OTP metadata", dateTime(entry.created_at), entry.state, entry.phone, entry.otp ?? "", entry.consumed ? "Consumed" : "Not consumed", `Attempts: ${entry.attempts}; expires: ${dateTime(entry.expires_at)}`]) : []),
    ];
    downloadFile(`\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`, `safishapro-monitoring-report-${fileDate()}.csv`, "text/csv;charset=utf-8");
  };

  const exportPdf = () => {
    const report = window.open("", "_blank");
    if (!report) { setError("Your browser blocked the report window. Allow pop-ups and try again."); return; }
    const kpis = summary ? Object.entries(summary).map(([label, value]) => `<div class="kpi"><span>${escapeHtml(label.replace("_", " "))}</span><strong>${escapeHtml(value)}</strong></div>`).join("") : "";
    const auditRows = (canExportAudit ? audit : []).map((event) => `<tr><td>${escapeHtml(dateTime(event.created_at))}</td><td><strong>${escapeHtml(event.action)}</strong></td><td>${escapeHtml(event.actor_email ?? "System")}</td><td>${escapeHtml(event.target_type)}</td><td>${escapeHtml(event.target_id ?? "-")}</td></tr>`).join("") || "<tr><td colspan=\"5\" class=\"empty\">No administrative activity available.</td></tr>";
    const otpRows = (canExportOtp ? otp : []).map((entry) => `<tr><td>${escapeHtml(entry.phone)}</td><td>${escapeHtml(entry.otp ?? "-")}</td><td>${escapeHtml(entry.attempts)}</td><td>${escapeHtml(dateTime(entry.expires_at))}</td><td><span class=\"status\">${escapeHtml(entry.state)}</span></td></tr>`).join("") || "<tr><td colspan=\"5\" class=\"empty\">No OTP metadata available.</td></tr>";
    report.document.write(`<!doctype html><html><head><title>SafishaPro Monitoring Report</title><style>body{font-family:Arial,sans-serif;color:#15233a;margin:0;background:#f5f8fc}.page{max-width:1100px;margin:0 auto;background:#fff;padding:42px}.header{border-bottom:3px solid #173a6b;padding-bottom:22px;margin-bottom:28px}.brand{color:#173a6b;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}.header h1{margin:8px 0 6px;font-size:30px}.muted{color:#607087;font-size:13px}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:20px 0 30px}.kpi{border:1px solid #d8e1ec;border-radius:8px;padding:14px;background:#f8fbff}.kpi span{display:block;text-transform:capitalize;font-size:12px;color:#607087}.kpi strong{display:block;margin-top:8px;font-size:23px;color:#173a6b}h2{font-size:17px;margin:28px 0 10px;color:#173a6b}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;color:#516174;font-size:11px;text-transform:uppercase;letter-spacing:.4px;background:#edf3f9}th,td{border:1px solid #d8e1ec;padding:9px;vertical-align:top}tr:nth-child(even) td{background:#fbfdff}.status{display:inline-block;padding:3px 7px;border-radius:999px;background:#dceaf9;color:#173a6b;text-transform:capitalize}.empty{text-align:center;color:#607087;padding:18px}.footer{border-top:1px solid #d8e1ec;margin-top:28px;padding-top:12px;color:#607087;font-size:11px}@media print{body{background:#fff}.page{max-width:none;padding:0}h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}.kpis{grid-template-columns:repeat(5,1fr)}}</style></head><body><main class=\"page\"><header class=\"header\"><div class=\"brand\">SafishaPro</div><h1>Audit & OTP Monitoring Report</h1><div class=\"muted\">Generated ${escapeHtml(new Date().toLocaleString())} · Includes the currently loaded monitoring records</div></header>${kpis ? `<section class=\"kpis\">${kpis}</section>` : ""}<section><h2>Administrative activity</h2><table><thead><tr><th>Timestamp</th><th>Action</th><th>Actor</th><th>Target type</th><th>Target ID</th></tr></thead><tbody>${auditRows}</tbody></table></section><section><h2>Recent OTP metadata</h2><table><thead><tr><th>Phone number</th><th>OTP</th><th>Attempts</th><th>Expires at</th><th>Status</th></tr></thead><tbody>${otpRows}</tbody></table></section><footer class=\"footer\">Confidential operational report · SafishaPro</footer></main><script>window.onload=()=>window.print()<\/script></body></html>`);
    report.document.close();
  };

  return <div className="space-y-6">
    <PageHeader title="Audit & OTP Monitoring" description="Administrative activity and OTP metadata. This is not a complete login history." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={load}>Refresh</Button><Button variant="outline" disabled={!canExport} onClick={exportCsv}><Download className="mr-2 size-4" />Export CSV</Button><Button disabled={!canExport} onClick={exportPdf}><FileText className="mr-2 size-4" />Export PDF report</Button></div>} />
    {error && <p className="text-sm text-destructive">{error}</p>}
    {canExport && <p className="-mt-3 text-xs text-muted-foreground">Exports include all monitoring records currently loaded in the dashboard.</p>}
    {summary && <div className="grid gap-3 sm:grid-cols-5">{Object.entries(summary).map(([label, value]) => <Card key={label} className="p-4"><div className="text-xs text-muted-foreground capitalize">{label.replace("_", " ")}</div><div className="text-2xl font-semibold">{value}</div></Card>)}</div>}
    {can("otp_logs.read") && <section className="space-y-3"><h2 className="font-semibold">Recent OTP metadata</h2><Card className="overflow-hidden p-0">{otp.length ? <><Table><TableHeader><TableRow><TableHead>Phone number</TableHead><TableHead>OTP</TableHead><TableHead>Attempts</TableHead><TableHead>Expires at</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader><TableBody>{visibleOtp.map((entry) => { const active = entry.state === "active" && !entry.consumed; return <TableRow key={entry.id}><TableCell className="font-medium">{entry.phone}</TableCell><TableCell className="font-mono font-semibold tracking-wider text-blue-900">{entry.otp ?? "—"}</TableCell><TableCell>{entry.attempts}</TableCell><TableCell className="text-muted-foreground">{dateTime(entry.expires_at)}</TableCell><TableCell className="text-right"><Badge variant={active ? "success" : "destructive"}>{active ? "Active" : "Inactive"}</Badge></TableCell></TableRow>; })}</TableBody></Table><LogPagination page={Math.min(otpPage, otpPageCount)} total={otp.length} onPageChange={setOtpPage} /></> : <p className="p-4 text-sm text-muted-foreground">No OTP metadata was returned.</p>}</Card></section>}
    {can("audit_logs.read") && <section className="space-y-3"><h2 className="font-semibold">Administrative activity</h2><Card className="divide-y p-0">{audit.length ? <>{visibleAudit.map((event) => <div key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"><span className="font-medium">{event.action}</span><span className="text-muted-foreground">by {event.actor_email ?? "System"}</span><span className="text-muted-foreground">· {event.target_type}</span><span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">{dateTime(event.created_at)}</span></div>)}<LogPagination page={Math.min(auditPage, auditPageCount)} total={audit.length} onPageChange={setAuditPage} /></> : <p className="p-4 text-sm text-muted-foreground">No administrative activity in the current API window.</p>}</Card></section>}
  </div>;
}
