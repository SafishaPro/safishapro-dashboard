import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Building2, ClipboardCheck, FileText, Package, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { cleanersApi, financeSettingsApi, type CleanerKycDocumentType } from "@/lib/api";

export const Route = createFileRoute("/_dash/settings")({ component: SettingsPage });

const descriptions: Record<string, string> = {
  "/services": "Maintain the services customers can book, their packages, add-ons, and prices.",
  "/property-types": "Manage the property types used to describe a customer’s space.",
  "/registration-fields": "Choose the fields customers see during signup and which answers complete their profiles.",
  "/staff": "Review staff accounts and their assigned access.",
  "/roles": "Control staff roles and the permissions available to each role.",
  "/audit": "Review administrative activity and one-time-password events.",
};
const icons = {
  "/services": Package,
  "/property-types": Building2,
  "/registration-fields": UsersRound,
  "/staff": UsersRound,
  "/roles": ShieldCheck,
  "/audit": ClipboardCheck,
};
const groups = [
  { title: "Service setup", routes: ["/services", "/property-types"] },
  { title: "Customer onboarding", routes: ["/registration-fields"] },
  { title: "People & access", routes: ["/staff", "/roles"] },
  { title: "Oversight", routes: ["/audit"] },
];

function SettingsPage() {
  const { user, permissions, can } = useAuth();
  const [commissionRate, setCommissionRate] = useState("15");
  const [commissionError, setCommissionError] = useState<string | null>(null);
  const [savingCommission, setSavingCommission] = useState(false);
  const [cleanerDocuments, setCleanerDocuments] = useState<CleanerKycDocumentType[]>([]);
  const [newDocumentLabel, setNewDocumentLabel] = useState("");
  const [savingDocuments, setSavingDocuments] = useState(false);
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  useEffect(() => {
    if (permissions.has("commissions.read")) {
      void financeSettingsApi.get()
        .then((value) => setCommissionRate(String(value.commission_rate_percent)))
        .catch((cause) => setCommissionError(cause instanceof Error ? cause.message : "Could not load the commission setting."));
    }
  }, [permissions]);
  useEffect(() => {
    if (permissions.has("cleaners.read")) {
      void cleanersApi.kycDocumentTypes()
        .then(setCleanerDocuments)
        .catch((cause) => setDocumentError(cause instanceof Error ? cause.message : "Could not load cleaner documents."));
    }
  }, [permissions]);
  const saveCommissionSetting = async () => {
    const percent = Number(commissionRate);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setCommissionError("Enter a percentage between 0 and 100.");
      return;
    }
    try {
      setSavingCommission(true);
      setCommissionError(null);
      const saved = await financeSettingsApi.update({ commission_rate_percent: percent });
      setCommissionRate(String(saved.commission_rate_percent));
    } catch (cause) {
      setCommissionError(cause instanceof Error ? cause.message : "Could not save the commission setting.");
    } finally {
      setSavingCommission(false);
    }
  };
  const saveCleanerDocuments = async () => {
    try {
      setSavingDocuments(true);
      setDocumentError(null);
      setDocumentMessage(null);
      const saved = await cleanersApi.saveKycDocumentTypes(cleanerDocuments.map((item, position) => ({ ...item, position, is_active: true })));
      setCleanerDocuments(saved);
      setDocumentMessage("Cleaner document requirements saved.");
    } catch (cause) {
      setDocumentError(cause instanceof Error ? cause.message : "Could not save cleaner document requirements.");
    } finally {
      setSavingDocuments(false);
    }
  };
  const addCleanerDocument = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = newDocumentLabel.trim();
    const code = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (label.length < 2 || code.length < 2) {
      setDocumentError("Enter a document name with at least two characters.");
      return;
    }
    if (cleanerDocuments.some((item) => item.code === code)) {
      setDocumentError("A document with that name already exists.");
      return;
    }
    setDocumentError(null);
    setDocumentMessage(null);
    setCleanerDocuments((items) => [...items, { code, label, required: false, is_active: true, position: items.length }]);
    setNewDocumentLabel("");
  };
  const allowed = new Map(navFor(permissions, user?.role.slug).map((item) => [item.to, item]));
  const availableGroups = groups.map((group) => ({ ...group, items: group.routes.map((route) => allowed.get(route)).filter((item) => item != null) })).filter((group) => group.items.length > 0);

  return <div className="space-y-7">
    <PageHeader title="System configuration" description="Manage the parts of Clean Match that shape service delivery, staff access, and oversight." />
    {can("cleaners.read") && <Card className="flex flex-col gap-4 border-slate-200 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileText className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Cleaner document requirements</h2><p className="mt-1 text-sm leading-6 text-slate-600">Configure which cleaner documents are required or optional.</p></div></div>
      <Button variant="outline" disabled={!can("cleaners.update")} onClick={() => { setDocumentError(null); setDocumentMessage(null); setDocumentsDialogOpen(true); }}>Manage documents</Button>
    </Card>}
    <Dialog open={documentsDialogOpen} onOpenChange={setDocumentsDialogOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Cleaner document requirements</DialogTitle></DialogHeader>
        {can("cleaners.read") ? <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Edit document names, set required or optional status, and add or remove document types. Required documents are checked before a cleaner can be activated.</p>
          <div className="space-y-2">{cleanerDocuments.map((document) => <div key={document.code} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div className="space-y-1"><Label htmlFor={`cleaner-doc-${document.code}`}>Document name</Label><Input id={`cleaner-doc-${document.code}`} value={document.label} maxLength={160} disabled={!can("cleaners.update")} onChange={(event) => { setDocumentMessage(null); setCleanerDocuments((items) => items.map((item) => item.code === document.code ? { ...item, label: event.target.value } : item)); }} /></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={document.required} disabled={!can("cleaners.update")} onCheckedChange={(checked) => { setDocumentMessage(null); setCleanerDocuments((items) => items.map((item) => item.code === document.code ? { ...item, required: Boolean(checked) } : item)); }} />Required</label>{can("cleaners.update") && <Button type="button" variant="outline" onClick={() => { setDocumentMessage(null); setCleanerDocuments((items) => items.filter((item) => item.code !== document.code)); }}>Remove</Button>}</div>)}{cleanerDocuments.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No cleaner document types configured.</p>}</div>
          {can("cleaners.update") && <form className="flex flex-col gap-2 border-t pt-4 sm:flex-row" onSubmit={addCleanerDocument}><div className="flex-1 space-y-2"><Label htmlFor="new-cleaner-document">Add a document type</Label><Input id="new-cleaner-document" value={newDocumentLabel} onChange={(event) => setNewDocumentLabel(event.target.value)} placeholder="e.g. First aid certificate" maxLength={160} /></div><Button type="submit" variant="outline" className="sm:mt-7"><Plus className="mr-2 size-4" />Add document</Button></form>}
          {documentMessage && <p role="status" className="text-sm text-emerald-700">{documentMessage}</p>}
          {documentError && <p role="alert" className="text-sm text-destructive">{documentError}</p>}
          <div className="flex justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={() => setDocumentsDialogOpen(false)}>Close</Button>{can("cleaners.update") && <Button onClick={() => void saveCleanerDocuments()} disabled={savingDocuments}>{savingDocuments ? "Saving…" : "Save requirements"}</Button>}</div>
        </div> : <p className="text-sm text-muted-foreground">Your role needs cleaners.read to view cleaner document requirements.</p>}
      </DialogContent>
    </Dialog>
    <Card className="space-y-4 border-slate-200 p-5 shadow-sm">
      <div>
        <h2 className="font-semibold text-slate-900">Commission setting</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Set the company commission percentage deducted from each completed booking. New automatic payouts use the saved rate; existing payouts are unchanged.</p>
      </div>
      {can("commissions.read") ? <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2"><Label htmlFor="commission-rate">Commission rate (%)</Label><Input id="commission-rate" type="number" min="0" max="100" step="0.01" className="w-40" value={commissionRate} onChange={(event) => setCommissionRate(event.target.value)} disabled={!can("commissions.update")} /></div>
        {can("commissions.update") && <Button onClick={() => void saveCommissionSetting()} disabled={savingCommission}>{savingCommission ? "Saving…" : "Save commission"}</Button>}
        {!can("commissions.update") && <p className="pb-2 text-sm text-muted-foreground">You can view this setting but need commissions.update permission to change it.</p>}
      </div> : <p className="text-sm text-muted-foreground">Your role needs commissions.read to view this setting and commissions.update to change it.</p>}
      {commissionError && <p className="text-sm text-destructive">{commissionError}</p>}
    </Card>
    <div className="grid gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-slate-50 to-white p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-6">
      <div className="grid size-12 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm ring-1 ring-blue-100"><ShieldCheck className="size-6" /></div>
      <div><p className="font-semibold text-slate-900">Configuration, in the right place</p><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Each control opens its live management area. This page no longer shows sample values or switches that are not connected to saved platform settings.</p></div>
    </div>
    {availableGroups.length ? availableGroups.map((group) => <section key={group.title} className="space-y-3"><div><h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.title}</h2></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{group.items.map((item) => {
      const Icon = icons[item.to as keyof typeof icons] ?? Package;
      return <Link key={item.to} to={item.to} className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><Card className="h-full border-slate-200 p-5 shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md"><div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white"><Icon className="size-5" /></span><ArrowRight className="mt-1 size-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" /></div><h3 className="mt-4 font-semibold text-slate-900">{item.label}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{descriptions[item.to]}</p></Card></Link>;
    })}</div></section>) : <Card className="border-dashed p-8 text-center"><p className="font-medium">No configuration tools are assigned to your account.</p><p className="mt-1 text-sm text-muted-foreground">Ask a system administrator to grant access to the relevant management areas.</p></Card>}
  </div>;
}
