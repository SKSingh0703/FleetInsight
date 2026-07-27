import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { verifyPaymentAdviceApi, PaymentAdviceTallyReport, PaymentAdviceTallyItem } from "@/services/api";
import { FileText, CheckCircle2, AlertCircle, Loader2, Search, AlertTriangle, Eye, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

export default function PaymentAdvicePage() {
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "MATCHED" | "NOT_MATCHED">("ALL");
  const [tallyData, setTallyData] = useState<{ originalName: string; report: PaymentAdviceTallyReport } | null>(null);
  const [selectedItem, setSelectedItem] = useState<PaymentAdviceTallyItem | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => verifyPaymentAdviceApi(file),
    onSuccess: (data) => {
      const rep = data.report || (data as any).tallyReport;
      setTallyData({
        originalName: data.originalName,
        report: rep,
      });
      const matched = (rep.totalAdviceItems || 0) - (rep.missingCount || 0);
      toast({
        title: "Payment Advice Tallied!",
        description: `${matched} of ${rep.totalAdviceItems} records matched to Google Drive Annexure Bills.`,
      });
    },
    onError: (err) => {
      toast({
        title: "Verification failed",
        description: err instanceof Error ? err.message : "Failed to verify payment advice file",
        variant: "destructive",
      });
    },
  });

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const report = tallyData?.report;
  const matchedCount = report?.totalMatched ?? 0;
  const missingCount = report?.totalUnmatched ?? 0;

  const filteredItems = (report?.items || []).filter((item) => {
    const isMatched = item.status !== "NOT_FOUND" && item.status !== "NOT_FOUND_IN_ANNEXURE";
    if (statusFilter === "MATCHED" && !isMatched) return false;
    if (statusFilter === "NOT_MATCHED" && isMatched) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      (item.deliveryNumber || "").toLowerCase().includes(q) ||
      (item.invoiceNumber || "").toLowerCase().includes(q) ||
      (item.billNumber || "").toLowerCase().includes(q) ||
      (item.vehicleNumber || "").toLowerCase().includes(q) ||
      (item.lrNumber || "").toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "MATCHED":
      case "TALLIED":
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">MATCHED ✅</Badge>;
      case "MATCHED_SHORT_PAID":
      case "SHORT_PAID":
        return <Badge variant="destructive">MATCHED (Short Paid) ⚠️</Badge>;
      case "MATCHED_EXCESS_PAID":
      case "EXCESS_PAID":
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">MATCHED (Excess) ℹ️</Badge>;
      case "NOT_FOUND":
      case "NOT_FOUND_IN_ANNEXURE":
        return <Badge variant="outline" className="text-destructive border-destructive/30">NO MATCH FOUND ❌</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Payment Advice Tally & Verification</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a Payment Advice PDF or XLSX file to match records against Google Drive Annexure Bills.
        </p>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload Payment Advice</CardTitle>
          <CardDescription>Upload Payment Advice PDF or XLSX to tally against extracted Google Drive Annexure Bills.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              dragOver ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
            }`}
          >
            {uploadMutation.isPending ? (
              <div className="space-y-3 py-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm font-medium">Tallying Payment Advice against Annexure Bills…</p>
                <p className="text-xs text-muted-foreground">Matching delivery & invoice numbers to retrieve Bill Numbers</p>
              </div>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">Drag & drop your Payment Advice file here</p>
                <p className="text-xs text-muted-foreground mb-4">Supports .pdf, .xlsx, .xls</p>
                <label htmlFor="advice-file-input">
                  <Button variant="outline" size="sm" asChild>
                    <span className="cursor-pointer">Browse File</span>
                  </Button>
                  <input
                    id="advice-file-input"
                    type="file"
                    className="hidden"
                    accept=".pdf,.xlsx,.xls"
                    onChange={handleFileInput}
                  />
                </label>
              </>
            )}
          </div>

          {uploadMutation.isError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Verification Error</AlertTitle>
              <AlertDescription>{uploadMutation.error?.message || "Failed to parse payment advice file"}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tally Report Section */}
      {tallyData && report && (
        <div className="space-y-6">
          {/* Status Alert Banners */}
          {missingCount === 0 ? (
            <Alert className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle className="text-base font-bold">100% MATCH FOUND ✅</AlertTitle>
              <AlertDescription className="text-xs">
                All {report.totalAdviceItems} records in {tallyData.originalName} matched to Google Drive Annexure Bills!
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-base font-bold">Match Results for {tallyData.originalName}</AlertTitle>
              <AlertDescription className="text-xs">
                Out of {report.totalAdviceItems} records: <strong>{matchedCount} Matched</strong> to Annexure Bills, and <strong>{missingCount} Not Found</strong> in Google Drive Annexures.
              </AlertDescription>
            </Alert>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="bg-card">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Total Advice Items</div>
                <div className="text-2xl font-bold mt-1">{report.totalAdviceItems}</div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Matched Records</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {matchedCount}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">No Match Found</div>
                <div className={`text-2xl font-bold mt-1 ${missingCount > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {missingCount}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Advice Paid Amount</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  ₹{report.totalAdvicePaidAmount.toLocaleString("en-IN")}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Delivery-Wise Itemized Table */}
          <Card>
            <CardHeader className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Record-by-Record Match Breakdown</CardTitle>
                  <CardDescription className="text-xs">
                    Complete line-item details extracted from Payment Advice checked against Google Drive Annexure Bills.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <TabsList className="h-8 text-xs">
                      <TabsTrigger value="ALL" className="text-xs py-1 px-2.5">All ({report.totalAdviceItems})</TabsTrigger>
                      <TabsTrigger value="MATCHED" className="text-xs py-1 px-2.5">Matched ({matchedCount})</TabsTrigger>
                      <TabsTrigger value="NOT_MATCHED" className="text-xs py-1 px-2.5">No Match ({missingCount})</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="w-full sm:w-56 relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter delivery, bill, vehicle..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="text-xs pl-9 h-8"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-2">
              <div className="overflow-x-auto rounded-lg border max-h-[70vh]">
                <Table className="text-xs">
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="py-2 font-bold whitespace-nowrap">Invoice / Delivery No</TableHead>
                      <TableHead className="py-2 font-bold text-primary whitespace-nowrap">Matched Bill No</TableHead>
                      <TableHead className="py-2 whitespace-nowrap">Vehicle No</TableHead>
                      <TableHead className="py-2 whitespace-nowrap">LR Number & Date</TableHead>
                      <TableHead className="py-2 whitespace-nowrap">Material Type</TableHead>
                      <TableHead className="py-2 whitespace-nowrap">Consignor → Consignee</TableHead>
                      <TableHead className="py-2 whitespace-nowrap">Destination</TableHead>
                      <TableHead className="py-2 whitespace-nowrap text-right">Net / Gross Wt (MT)</TableHead>
                      <TableHead className="py-2 whitespace-nowrap text-right">Freight Base (₹)</TableHead>
                      <TableHead className="py-2 whitespace-nowrap text-right">Taxes (₹)</TableHead>
                      <TableHead className="py-2 whitespace-nowrap text-right">Annexure Total (₹)</TableHead>
                      <TableHead className="py-2 whitespace-nowrap text-right">Advice Paid Net (₹)</TableHead>
                      <TableHead className="py-2 whitespace-nowrap text-right">Variance / Shortage (₹)</TableHead>
                      <TableHead className="py-2 whitespace-nowrap text-center">Match Result</TableHead>
                      <TableHead className="py-2 whitespace-nowrap">Source Excel File</TableHead>
                      <TableHead className="py-2 whitespace-nowrap text-center">Full Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item, idx) => {
                      const ann = item.annexureRecord;
                      const taxSum = (ann?.sgst || 0) + (ann?.cgst || 0) + (ann?.igst || 0);
                      const lrDateFormatted = ann?.lrDate ? new Date(ann.lrDate).toLocaleDateString("en-IN") : "";
                      return (
                        <TableRow key={idx} className="hover:bg-muted/30">
                          <TableCell className="font-mono font-semibold whitespace-nowrap">
                            {item.deliveryNumber || item.invoiceNumber || "—"}
                          </TableCell>
                          <TableCell className="font-semibold text-primary whitespace-nowrap">
                            {item.billNumber !== "NOT_FOUND" ? item.billNumber : "—"}
                          </TableCell>
                          <TableCell className="font-mono whitespace-nowrap">{ann?.vehicleNumber || item.vehicleNumber || "—"}</TableCell>
                          <TableCell className="font-mono whitespace-nowrap">
                            {ann?.lrNumber || item.lrNumber ? (
                              <div>
                                <div className="font-semibold">{ann?.lrNumber || item.lrNumber}</div>
                                {lrDateFormatted ? <div className="text-[10px] text-muted-foreground">{lrDateFormatted}</div> : null}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{ann?.materialType || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap max-w-[220px] truncate" title={`${ann?.consignorName || ''} -> ${ann?.consigneeName || ''}`}>
                            {ann?.consignorName ? <span className="font-medium">{ann.consignorName}</span> : null}
                            {ann?.consigneeName ? <span className="text-muted-foreground"> → {ann.consigneeName}</span> : null}
                            {!ann?.consignorName && !ann?.consigneeName ? "—" : null}
                          </TableCell>
                          <TableCell className="whitespace-nowrap max-w-[160px] truncate" title={ann?.destination || ''}>
                            {ann?.destination || "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-mono">
                            {ann?.netWeight || ann?.grossWeight ? (
                              <div>
                                <div className="font-semibold">{ann.netWeight ? `${ann.netWeight} MT` : "—"}</div>
                                {ann.grossWeight ? <div className="text-[10px] text-muted-foreground">Gr: {ann.grossWeight} MT</div> : null}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-mono">
                            {ann?.freightBaseAmount ? `₹${ann.freightBaseAmount.toLocaleString("en-IN")}` : "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-mono">
                            {taxSum > 0 ? `₹${taxSum.toLocaleString("en-IN")}` : "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-mono font-bold">
                            {item.annexureBillAmount ? `₹${item.annexureBillAmount.toLocaleString("en-IN")}` : "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{item.advicePaidAmount.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className={`text-right whitespace-nowrap font-mono font-bold ${item.variance > 0 ? "text-destructive" : item.variance < 0 ? "text-emerald-600" : "text-emerald-600"}`}>
                            {item.variance ? `₹${item.variance.toLocaleString("en-IN")}` : "₹0"}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="whitespace-nowrap max-w-[140px] truncate text-[11px] font-mono text-muted-foreground" title={ann?.fileName || ''}>
                            {ann?.fileName || "—"}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs flex items-center gap-1 mx-auto"
                              onClick={() => setSelectedItem(item)}
                            >
                              <Eye className="h-3.5 w-3.5 text-primary" />
                              <span>View All</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={16} className="py-8 text-center text-muted-foreground">
                          {search ? `No records matching "${search}"` : "No records to display."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Matched Record Full Data Modal Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <span>Full Annexure & Payment Data</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete line-item details extracted from Google Drive Annexure Excel file.
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 text-xs">
              {/* Match Summary Box */}
              <div className="p-3 rounded-lg border bg-muted/30 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Match Status</div>
                  <div className="font-semibold text-sm mt-0.5">{getStatusBadge(selectedItem.status)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Bill Number</div>
                  <div className="font-bold text-sm text-primary">{selectedItem.billNumber}</div>
                </div>
              </div>

              {/* Extracted Payment Advice Data Card */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Extracted Payment Advice Record</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border bg-muted/20">
                  <div>
                    <div className="text-muted-foreground text-[11px]">Invoice / Delivery No</div>
                    <div className="font-mono font-semibold">{selectedItem.invoiceNumber || selectedItem.deliveryNumber || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[11px]">Document Number</div>
                    <div className="font-mono">{selectedItem.adviceRecord?.documentNumber || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[11px]">Advice Paid Amount</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{selectedItem.advicePaidAmount?.toLocaleString("en-IN") || "0"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[11px]">Advice Date</div>
                    <div>{selectedItem.adviceRecord?.adviceDate ? new Date(selectedItem.adviceRecord.adviceDate).toLocaleDateString("en-IN") : "—"}</div>
                  </div>
                </div>
              </div>

              {/* Annexure Data Grid */}
              {selectedItem.annexureRecord ? (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Google Drive Annexure Data</h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg border bg-card">
                    <div>
                      <div className="text-muted-foreground text-[11px]">Bill Number</div>
                      <div className="font-semibold">{selectedItem.annexureRecord.billNumber || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Invoice Number</div>
                      <div className="font-mono">{selectedItem.annexureRecord.invoiceNumber || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Delivery Number</div>
                      <div className="font-mono">{selectedItem.annexureRecord.deliveryNumber || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Vehicle Number</div>
                      <div className="font-semibold">{selectedItem.annexureRecord.vehicleNumber || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">LR Number</div>
                      <div className="font-mono">{selectedItem.annexureRecord.lrNumber || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">LR Date</div>
                      <div>{selectedItem.annexureRecord.lrDate ? new Date(selectedItem.annexureRecord.lrDate).toLocaleDateString("en-IN") : "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Material Type</div>
                      <div>{selectedItem.annexureRecord.materialType || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Consignor Name</div>
                      <div>{selectedItem.annexureRecord.consignorName || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Consignee Name</div>
                      <div>{selectedItem.annexureRecord.consigneeName || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Destination</div>
                      <div>{selectedItem.annexureRecord.destination || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Net Weight</div>
                      <div>{selectedItem.annexureRecord.netWeight ? `${selectedItem.annexureRecord.netWeight} MT` : "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Gross Weight</div>
                      <div>{selectedItem.annexureRecord.grossWeight ? `${selectedItem.annexureRecord.grossWeight} MT` : "—"}</div>
                    </div>
                  </div>

                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Financial Breakdown</h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border bg-card">
                    <div>
                      <div className="text-muted-foreground text-[11px]">Freight Base Amount</div>
                      <div className="font-semibold">₹{selectedItem.annexureRecord.freightBaseAmount?.toLocaleString("en-IN") || "0"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">SGST</div>
                      <div>₹{selectedItem.annexureRecord.sgst?.toLocaleString("en-IN") || "0"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">CGST</div>
                      <div>₹{selectedItem.annexureRecord.cgst?.toLocaleString("en-IN") || "0"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">IGST</div>
                      <div>₹{selectedItem.annexureRecord.igst?.toLocaleString("en-IN") || "0"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Annexure Total Amount</div>
                      <div className="font-bold text-sm">₹{selectedItem.annexureRecord.totalAmount?.toLocaleString("en-IN") || "0"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Advice Paid Net</div>
                      <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">₹{selectedItem.advicePaidAmount?.toLocaleString("en-IN") || "0"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Variance / Shortage</div>
                      <div className={`font-bold text-sm ${selectedItem.variance > 0 ? "text-destructive" : "text-emerald-600"}`}>
                        ₹{selectedItem.variance?.toLocaleString("en-IN") || "0"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Source Annexure Excel</div>
                      <div className="truncate font-mono text-[11px]">{selectedItem.annexureRecord.fileName || "—"}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground border rounded-lg">
                  <XCircle className="h-8 w-8 text-destructive mx-auto mb-2 opacity-60" />
                  <p className="font-semibold">No Annexure Match Found</p>
                  <p className="text-xs mt-1">This payment advice record ({selectedItem.deliveryNumber || selectedItem.invoiceNumber}) does not match any extracted Google Drive Annexures yet.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
