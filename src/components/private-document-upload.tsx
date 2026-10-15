import { useEffect, useState } from "react";
import { ExternalLink, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEDIA_UPLOAD_MAX_BYTES, isUploadWithinLimit } from "@/lib/api";

type PrivateDocumentUploadProps = {
  title: string;
  uploaded: boolean;
  canUpload: boolean;
  loadPreview: () => Promise<Blob>;
  onUpload: (file: File) => Promise<unknown>;
  onView: () => Promise<void>;
};

export function PrivateDocumentUpload({ title, uploaded, canUpload, loadPreview, onUpload, onView }: PrivateDocumentUploadProps) {
  const [hasUpload, setHasUpload] = useState(uploaded);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setHasUpload(uploaded), [uploaded]);
  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;
    const show = async () => {
      try {
        const blob = file ?? (hasUpload ? await loadPreview() : null);
        if (!blob || !active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        setPreviewType(blob.type);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : `Unable to preview ${title.toLowerCase()}.`);
      }
    };
    setPreviewUrl(null);
    void show();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, hasUpload]);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await onUpload(file);
      setHasUpload(true);
      setFile(null);
      setMessage(`${title} uploaded.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to upload ${title.toLowerCase()}.`);
    } finally {
      setBusy(false);
    }
  };

  return <section className="space-y-3 rounded-lg border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h4 className="font-medium">{title}</h4><p className="text-xs text-muted-foreground">{hasUpload ? "Submitted" : "Not submitted"} · Private storage</p></div>
      {hasUpload && <Button type="button" size="sm" variant="outline" onClick={() => void onView()}><ExternalLink className="size-4" />View</Button>}
    </div>
    {(previewUrl || hasUpload) && <div className="flex min-h-24 items-center gap-3 overflow-hidden rounded-md bg-muted/40 p-2">
      {previewUrl && previewType.startsWith("image/") ? <img src={previewUrl} alt={`${title} preview`} className="max-h-28 max-w-36 rounded object-contain" /> : previewUrl && previewType === "application/pdf" ? <iframe title={`${title} preview`} src={previewUrl} className="h-28 w-36 rounded border bg-white" /> : <div className="flex size-16 shrink-0 items-center justify-center rounded bg-background"><FileText className="size-8 text-muted-foreground" /></div>}
      <p className="text-xs text-muted-foreground">{file ? file.name : hasUpload ? "Uploaded document preview" : "Selected document"}</p>
    </div>}
    {canUpload && <div className="flex flex-wrap items-center gap-2">
      <Input type="file" className="min-w-48 flex-1" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => {
        const selected = event.target.files?.[0] ?? null;
        if (selected && !isUploadWithinLimit(selected, MEDIA_UPLOAD_MAX_BYTES, "Document")) { event.currentTarget.value = ""; setFile(null); return; }
        setError(null); setFile(selected);
      }} />
      <Button type="button" size="sm" disabled={!file || busy} onClick={() => void upload()}><Upload className="size-4" />{busy ? "Uploading…" : hasUpload ? "Replace" : "Upload"}</Button>
    </div>}
    <p className="text-xs text-muted-foreground">PDF or image; up to 10 MB.</p>
    {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </section>;
}
