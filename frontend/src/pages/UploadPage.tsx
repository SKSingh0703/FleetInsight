import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

type UploadState = "idle" | "uploading" | "success" | "error";

export default function UploadPage() {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const simulateUpload = useCallback((file: File) => {
    setFileName(file.name);
    setState("uploading");
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setState("success");
          return 100;
        }
        return p + Math.random() * 15;
      });
    }, 200);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) simulateUpload(file);
    },
    [simulateUpload]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) simulateUpload(file);
  };

  const reset = () => {
    setState("idle");
    setProgress(0);
    setFileName("");
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Upload Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your Google Sheets export (.csv, .xlsx) to import trip data
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
            <p className="text-xs text-muted-foreground mb-4">Supports .csv and .xlsx files</p>
            <label>
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer">Browse Files</span>
              </Button>
              <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileInput} />
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
          <div className="text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <div>
              <p className="text-sm font-semibold">Upload complete!</p>
              <p className="text-xs text-muted-foreground">{fileName} has been processed successfully</p>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>Upload Another</Button>
          </div>
        )}

        {state === "error" && (
          <div className="text-center space-y-3">
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <div>
              <p className="text-sm font-semibold">Upload failed</p>
              <p className="text-xs text-muted-foreground">Please check your file format and try again</p>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>Try Again</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
