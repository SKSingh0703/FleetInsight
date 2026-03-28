import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { uploadFile } from "@/services/api";

type UploadState = "idle" | "uploading" | "success" | "error";

function getRawString(raw: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

export default function UploadPage() {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showRejected, setShowRejected] = useState(false);
  const [rejectedLimit, setRejectedLimit] = useState(50);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      setErrorMessage("");
      setFileName(file.name);
      setState("uploading");
      setProgress(0);
      return uploadFile(file, {
        onProgress: (p) => setProgress(p),
      });
    },
    onSuccess: () => {
      setProgress(100);
      setState("success");
    },
    onError: (err) => {
      setState("error");
      setProgress(0);
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
    },
  });

  const startUpload = useCallback(
    (file: File) => {
      mutation.mutate(file);
    },
    [mutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) startUpload(file);
    },
    [startUpload]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
  };

  const reset = () => {
    setState("idle");
    setProgress(0);
    setFileName("");
    setErrorMessage("");
    mutation.reset();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Upload Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your Excel file (.xlsx) to import trip data
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all duration-200 ${
          dragOver
            ? "border-primary bg-primary/5"
            : state === "success"
            ? "border-success/40 bg-success/5"
            : state === "error"
            ? "border-destructive/40 bg-destructive/5"
            : "border-border bg-card hover:border-primary/30"
        }`}
      >
        {state === "idle" && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">Drag & drop your file here</p>
            <p className="text-xs text-muted-foreground mb-4">Supports .xlsx files</p>
            <label>
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer">Browse Files</span>
              </Button>
              <input type="file" className="hidden" accept=".xlsx" onChange={handleFileInput} />
            </label>
          </>
        )}

        {state === "uploading" && (
          <div className="w-full max-w-xs space-y-4 text-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
            <div>
              <div className="flex items-center gap-2 justify-center mb-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate">{fileName}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{Math.min(Math.round(progress), 100)}%</p>
            </div>
          </div>
        )}

        {state === "success" && (
          <div className="text-center space-y-4 w-full">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <div>
              <p className="text-sm font-semibold">Upload complete!</p>
              <p className="text-xs text-muted-foreground">{fileName} has been processed successfully</p>
            </div>

            {mutation.data?.summary && (
              <div className="grid grid-cols-2 gap-3 text-left max-w-xl mx-auto">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">Raw rows</p>
                  <p className="text-sm font-semibold">{mutation.data.summary.rawRows}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">Processed trips</p>
                  <p className="text-sm font-semibold">{mutation.data.summary.processedTrips}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">Rejected rows</p>
                  <p className="text-sm font-semibold">{mutation.data.summary.rejectedRows}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">Duplicate invoices</p>
                  <p className="text-sm font-semibold">{mutation.data.summary.duplicateInvoiceNumbers}</p>
                </div>
              </div>
            )}

            {mutation.data?.storage && (
              <div className="grid grid-cols-2 gap-3 text-left max-w-xl mx-auto">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">Upserted (new)</p>
                  <p className="text-sm font-semibold">{mutation.data.storage.upserted}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">Modified (updated)</p>
                  <p className="text-sm font-semibold">{mutation.data.storage.modified}</p>
                </div>
              </div>
            )}

            {mutation.data?.errorRows && mutation.data.errorRows.length > 0 && (
              <div className="w-full max-w-5xl mx-auto text-left">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Rejected entries</p>
                    <p className="text-xs text-muted-foreground">
                      Showing {Math.min(rejectedLimit, mutation.data.errorRows.length)} of {mutation.data.errorRows.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejected((v) => !v)}
                    >
                      {showRejected ? "Hide" : "Show"}
                    </Button>
                    {showRejected && rejectedLimit < mutation.data.errorRows.length && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRejectedLimit((n) => Math.min(n + 50, mutation.data.errorRows.length))}
                      >
                        Show 50 more
                      </Button>
                    )}
                  </div>
                </div>

                {showRejected && (
                  <div className="mt-3 overflow-auto rounded-lg border bg-card">
                    <table className="min-w-[900px] w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="text-xs text-muted-foreground">
                          <th className="px-3 py-2 text-left">Sheet</th>
                          <th className="px-3 py-2 text-left">Row</th>
                          <th className="px-3 py-2 text-left">Vehicle</th>
                          <th className="px-3 py-2 text-left">Invoice</th>
                          <th className="px-3 py-2 text-left">Chassis</th>
                          <th className="px-3 py-2 text-left">Issues</th>
                          <th className="px-3 py-2 text-left">Raw preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mutation.data.errorRows.slice(0, rejectedLimit).map((e) => {
                          const raw: Record<string, unknown> = e.raw || {};
                          const vehicle = getRawString(raw, ["VEHICLE NO.", "VEHICLE NO", "V.NO.", "V NO", "VEHICLE NUMBER"]);
                          const invoice = getRawString(raw, ["INVOICE NO.", "INVOICE NO", "INV.NO", "INV.NO.", "INVOICE NUMBER"]);
                          const chassis = getRawString(raw, ["CH.NO.", "CHASSIS NO", "CHASSIS NO.", "CHASSIS NUMBER"]);

                          const previewEntries = Object.entries(raw).slice(0, 4);
                          const preview = previewEntries
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(" | ");

                          return (
                            <tr key={`${e.sheetName}-${e.rowNumber}`} className="border-t">
                              <td className="px-3 py-2 whitespace-nowrap">{e.sheetName}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{e.rowNumber}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{vehicle || "-"}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{invoice || e.invoiceNumber || "-"}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{chassis || "-"}</td>
                              <td className="px-3 py-2">
                                <div className="space-y-1">
                                  {e.issues?.map((it, idx) => (
                                    <div key={idx} className="text-xs">{it}</div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground max-w-[420px] truncate" title={preview}>
                                {preview || "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <Button variant="outline" size="sm" onClick={reset}>Upload Another</Button>
          </div>
        )}

        {state === "error" && (
          <div className="text-center space-y-3">
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <div>
              <p className="text-sm font-semibold">Upload failed</p>
              <p className="text-xs text-muted-foreground">{errorMessage || "Please check your file format and try again"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>Try Again</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
