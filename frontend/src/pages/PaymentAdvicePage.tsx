import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { verifyPaymentAdviceApi, PaymentAdviceTallyReport, PaymentAdviceTallyItem } from "@/services/api";
import { FileText, CheckCircle2, AlertCircle, Loader2, Search, AlertTriangle, Eye, Info, XCircle, Download } from "lucide-react";
import * as XLSX from "xlsx";
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
      const matched = rep.totalMatched ?? 0;
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

  const handleDownloadExcel = () => {
    if (!tallyData || !report) return;

    const wb = XLSX.utils.book_new();

    // 1. Complete Bill Line Items (Paid + Unpaid grouped by Bill Number)
    const completeBillRows: any[] = [];

    (report.billSummary || []).forEach((b: any) => {
      // Add paid items under this bill
      const paidItemsForBill = (report.items || []).filter((i) => i.billNumber === b.billNumber);
      paidItemsForBill.forEach((item) => {
        const ann = item.annexureRecord || {};
        const lrDateStr = ann.lrDate ? new Date(ann.lrDate).toLocaleDateString("en-IN") : "";
        const delDateStr = ann.deliveryDate ? new Date(ann.deliveryDate).toLocaleDateString("en-IN") : "";
        const freightBase = ann.freightBaseAmount || item.freightBaseAmount || 0;
        const tds2Pct = item.tdsAmount || (freightBase ? Math.round(freightBase * 0.02 * 100) / 100 : 0);
        const expectedNetPay = item.expectedPayable || (item.annexureBillAmount ? Math.round((item.annexureBillAmount - tds2Pct) * 100) / 100 : 0);

        completeBillRows.push({
          "Bill Number": b.billNumber,
          "Reconciliation Status": "PAID IN ADVICE ✅",
          "Consignment / LR No": ann.lrNumber || item.lrNumber || "—",
          "LR Date": lrDateStr || "—",
          "Delivery No": item.deliveryNumber || ann.deliveryNumber || "—",
          "Delivery Date": delDateStr || "—",
          "Invoice No (TSL)": item.invoiceNumber || ann.invoiceNumber || "—",
          "Vehicle No": item.vehicleNumber || ann.vehicleNumber || "—",
          "Material Type": ann.materialType || "—",
          "Consignor / Shipper": ann.consignorName || "—",
          "Consignee / Receiving": ann.consigneeName || "—",
          "Destination": ann.destination || "—",
          "Net Wt (MT)": ann.netWeight || 0,
          "Gross Wt (MT)": ann.grossWeight || 0,
          "Freight Base Amount (₹)": freightBase,
          "TDS (2% Freight) (₹)": tds2Pct,
          "Expected Net Value (₹)": expectedNetPay,
          "Annexure Total Value (₹)": item.annexureBillAmount || ann.totalAmount || 0,
          "Advice Paid Net (₹)": item.advicePaidAmount || 0,
          "Shortage / Unpaid Value (₹)": item.variance > 0 ? item.variance : 0,
          "FI Document / Payment Ref": item.documentNumber || item.paymentReferenceNumber || "—",
        });
      });

      // Add unpaid items under this bill
      if (b.unpaidItems && Array.isArray(b.unpaidItems)) {
        b.unpaidItems.forEach((u: any) => {
          const lrDateStr = u.lrDate ? new Date(u.lrDate).toLocaleDateString("en-IN") : "";
          const delDateStr = u.deliveryDate ? new Date(u.deliveryDate).toLocaleDateString("en-IN") : "";
          const freightBase = u.freightBaseAmount || 0;
          const tds2Pct = Math.round(freightBase * 0.02 * 100) / 100;
          const totalVal = u.totalAmount || 0;
          const expectedNetPay = Math.round((totalVal - tds2Pct) * 100) / 100;

          completeBillRows.push({
            "Bill Number": b.billNumber,
            "Reconciliation Status": "UNPAID / NOT IN ADVICE ⚠️",
            "Consignment / LR No": u.lrNumber || "—",
            "LR Date": lrDateStr || "—",
            "Delivery No": u.deliveryNumber || "—",
            "Delivery Date": delDateStr || "—",
            "Invoice No (TSL)": u.invoiceNumber || "—",
            "Vehicle No": u.vehicleNumber || "—",
            "Material Type": u.materialType || "—",
            "Consignor / Shipper": u.consignorName || "—",
            "Consignee / Receiving": u.consigneeName || "—",
            "Destination": u.destination || "—",
            "Net Wt (MT)": u.annexureRecord?.netWeight || 0,
            "Gross Wt (MT)": u.annexureRecord?.grossWeight || 0,
            "Freight Base Amount (₹)": freightBase,
            "TDS (2% Freight) (₹)": tds2Pct,
            "Expected Net Value (₹)": expectedNetPay,
            "Annexure Total Value (₹)": totalVal,
            "Advice Paid Net (₹)": 0,
            "Shortage / Unpaid Value (₹)": totalVal,
            "FI Document / Payment Ref": "—",
          });
        });
      }
    });

    if (completeBillRows.length > 0) {
      const wsComplete = XLSX.utils.json_to_sheet(completeBillRows);
      wsComplete["!cols"] = [
        { wch: 22 }, // Bill Number
        { wch: 28 }, // Status
        { wch: 24 }, // LR No
        { wch: 16 }, // LR Date
        { wch: 20 }, // Delivery No
        { wch: 16 }, // Delivery Date
        { wch: 20 }, // Invoice No
        { wch: 16 }, // Vehicle No
        { wch: 18 }, // Material Type
        { wch: 32 }, // Consignor
        { wch: 32 }, // Consignee
        { wch: 25 }, // Destination
        { wch: 14 }, // Net Wt
        { wch: 14 }, // Gross Wt
        { wch: 22 }, // Freight Base
        { wch: 20 }, // TDS
        { wch: 22 }, // Expected Net Value
        { wch: 22 }, // Annexure Total
        { wch: 20 }, // Advice Paid Net
        { wch: 22 }, // Shortage / Unpaid Value
        { wch: 26 }, // FI Document / Payment Ref
      ];
      XLSX.utils.book_append_sheet(wb, wsComplete, "Complete Bill Line Items");
    }

    // 2. Bill-Level Summary Breakdown
    const billSummaryRows = (report.billSummary || []).map((b: any) => {
      const unpaidCount = b.unpaidAnnexureItemsCount || 0;
      const totalCount = b.totalBillItems || b.deliveryCount || 0;
      const paidCount = b.paidAdviceItemsCount || b.deliveryCount || 0;
      const statusText = unpaidCount > 0
        ? `PARTIALLY PAID (${unpaidCount} Unpaid Item${unpaidCount > 1 ? "s" : ""})`
        : "FULLY PAID";

      return {
        "Bill Number": b.billNumber,
        "Reconciliation Status": statusText,
        "Total Bill Deliveries": totalCount,
        "Paid Advice Deliveries": paidCount,
        "Unpaid Deliveries Count": unpaidCount,
        "Total Bill Value (₹)": b.totalBillAmount || b.annexureBillAmt || 0,
        "Advice Paid Value (₹)": b.advicePaidAmt || 0,
        "Unpaid Shortage Value (₹)": b.unpaidAnnexureAmount || 0,
        "Freight Base Value (₹)": b.freightBaseAmt || 0,
        "TDS (2% Freight) (₹)": b.tdsAmount || 0,
        "Expected Net Value (₹)": b.expectedPayable || 0,
        "Variance (₹)": b.variance || 0,
      };
    });

    if (billSummaryRows.length > 0) {
      const wsBillSummary = XLSX.utils.json_to_sheet(billSummaryRows);
      wsBillSummary["!cols"] = [
        { wch: 22 }, { wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 24 },
        { wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 20 },
        { wch: 22 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsBillSummary, "Bill Summary Totals");
    }

    // 3. Unpaid & Missing Deliveries Breakdown
    const unpaidItemsRows: any[] = [];
    (report.billSummary || []).forEach((b: any) => {
      if (b.unpaidItems && Array.isArray(b.unpaidItems)) {
        b.unpaidItems.forEach((u: any) => {
          const lrDateStr = u.lrDate ? new Date(u.lrDate).toLocaleDateString("en-IN") : "";
          const delDateStr = u.deliveryDate ? new Date(u.deliveryDate).toLocaleDateString("en-IN") : "";
          unpaidItemsRows.push({
            "Bill Number": b.billNumber,
            "Consignment / LR No": u.lrNumber || "—",
            "LR Date": lrDateStr || "—",
            "Delivery No": u.deliveryNumber || "—",
            "Delivery Date": delDateStr || "—",
            "Invoice No (TSL)": u.invoiceNumber || "—",
            "Vehicle No": u.vehicleNumber || "—",
            "Material Type": u.materialType || "—",
            "Consignor / Shipper": u.consignorName || "—",
            "Consignee / Receiving": u.consigneeName || "—",
            "Destination": u.destination || "—",
            "Freight Base Amount (₹)": u.freightBaseAmount || 0,
            "Total Unpaid Value (₹)": u.totalAmount || 0,
            "Payment Status": "UNPAID / NOT IN ADVICE",
          });
        });
      }
    });

    if (unpaidItemsRows.length > 0) {
      const wsUnpaid = XLSX.utils.json_to_sheet(unpaidItemsRows);
      wsUnpaid["!cols"] = [
        { wch: 22 }, { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 16 },
        { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 32 }, { wch: 32 },
        { wch: 25 }, { wch: 22 }, { wch: 22 }, { wch: 26 },
      ];
      XLSX.utils.book_append_sheet(wb, wsUnpaid, "Unpaid Deliveries Only");
    }

    // 4. Record-by-Record Payment Advice Line Items
    const breakdownRows = (report.items || []).map((item) => {
      const ann = item.annexureRecord || {};

      let matchStatusText = "NO MATCH FOUND";
      if (item.status === "MATCHED" || item.status === "TALLIED") matchStatusText = "MATCHED (Exact)";
      else if (item.status === "MATCHED_TDS") matchStatusText = "MATCHED (2% TDS Deducted)";
      else if (item.status === "DEBIT_NOTE_DEDUCTION" || item.isDeduction) matchStatusText = "DEBIT NOTE / DEDUCTION";
      else if (item.status === "MATCHED_SHORT_PAID" || item.status === "SHORT_PAID") matchStatusText = "MATCHED (Short Paid)";
      else if (item.status === "MATCHED_EXCESS_PAID" || item.status === "EXCESS_PAID") matchStatusText = "MATCHED (Excess Paid)";

      const lrDateStr = ann.lrDate ? new Date(ann.lrDate).toLocaleDateString("en-IN") : "";
      const lrCombined = ann.lrNumber ? (lrDateStr ? `${ann.lrNumber} (${lrDateStr})` : ann.lrNumber) : "—";

      const consignorConsignee = (ann.consignorName || ann.consigneeName)
        ? `${ann.consignorName || "—"} → ${ann.consigneeName || "—"}`
        : "—";

      const weightCombined = (ann.netWeight || ann.grossWeight)
        ? `${ann.netWeight || "0"} / ${ann.grossWeight || "0"} MT`
        : "—";

      const taxesCombined = (ann.cgst || ann.sgst || ann.igst)
        ? `C:${ann.cgst || 0} S:${ann.sgst || 0} I:${ann.igst || 0}`
        : "—";

      const freightBase = ann.freightBaseAmount || item.freightBaseAmount || 0;
      const tds2Pct = item.tdsAmount || (freightBase ? Math.round(freightBase * 0.02 * 100) / 100 : 0);
      const expectedNetPay = item.expectedPayable || (item.annexureBillAmount ? Math.round((item.annexureBillAmount - tds2Pct) * 100) / 100 : 0);

      return {
        "Invoice / Delivery No": item.deliveryNumber || item.invoiceNumber || "—",
        "Matched Bill No": item.billNumber !== "NOT_FOUND" ? item.billNumber : "—",
        "Match Status": matchStatusText,
        "Vehicle No": item.vehicleNumber || ann.vehicleNumber || "—",
        "LR Number & Date": lrCombined,
        "Material Type": ann.materialType || "—",
        "Consignor → Consignee": consignorConsignee,
        "Destination": ann.destination || "—",
        "Net / Gross Wt": weightCombined,
        "Freight Base Amount (₹)": freightBase,
        "TDS (2% Freight) (₹)": tds2Pct,
        "Expected Net Payable (₹)": expectedNetPay,
        "Taxes": taxesCombined,
        "Annexure Total (₹)": item.annexureBillAmount || 0,
        "Advice Paid Net (₹)": item.advicePaidAmount || 0,
        "Variance / Shortage (₹)": item.variance || 0,
        "FI Document No": item.documentNumber || "—",
        "Payment Ref No": item.paymentReferenceNumber || "—",
        "Source Annexure File": ann.fileName || "—",
      };
    });

    const wsBreakdown = XLSX.utils.json_to_sheet(breakdownRows);
    wsBreakdown["!cols"] = [
      { wch: 22 }, { wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 24 },
      { wch: 18 }, { wch: 40 }, { wch: 25 }, { wch: 18 }, { wch: 22 },
      { wch: 20 }, { wch: 24 }, { wch: 22 }, { wch: 22 }, { wch: 20 },
      { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 35 },
    ];

    XLSX.utils.book_append_sheet(wb, wsBreakdown, "Payment Advice Raw Items");

    const safeFileName = tallyData.originalName.replace(/\.[^/.]+$/, "");
    const exportFileName = `Full_Bill_Reconciliation_${safeFileName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    XLSX.writeFile(wb, exportFileName);

    toast({
      title: "Full Reconciliation Excel Exported",
      description: `Exported complete bill line items (${completeBillRows.length} total deliveries), bill summaries, and advice items.`,
    });
  };

  const filteredItems = (report?.items || []).filter((item) => {
    const isMatched = item.status !== "NOT_FOUND" && item.status !== "NOT_FOUND_IN_ANNEXURE";
    if (statusFilter === "MATCHED" && !isMatched) return false;
    if (statusFilter === "NOT_MATCHED" && isMatched) return false;
    if (statusFilter === "SHORT_PAID" && item.status !== "MATCHED_SHORT_PAID") return false;
    if (statusFilter === "DEDUCTION" && item.status !== "DEBIT_NOTE_DEDUCTION" && !item.isDeduction) return false;

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

  const getStatusBadge = (status: string, isDeduction?: boolean) => {
    if (isDeduction || status === "DEBIT_NOTE_DEDUCTION") {
      return <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 font-semibold">DEBIT NOTE / DEDUCTION 🔻</Badge>;
    }
    switch (status) {
      case "MATCHED":
      case "TALLIED":
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold">MATCHED ✅</Badge>;
      case "MATCHED_TDS":
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 font-semibold">MATCHED (2% TDS) 🛡️</Badge>;
      case "MATCHED_SHORT_PAID":
      case "SHORT_PAID":
        return <Badge variant="destructive" className="font-semibold">MATCHED (Short Paid) ⚠️</Badge>;
      case "MATCHED_EXCESS_PAID":
      case "EXCESS_PAID":
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold">MATCHED (Excess) ℹ️</Badge>;
      case "NOT_FOUND":
      case "NOT_FOUND_IN_ANNEXURE":
        return <Badge variant="outline" className="text-destructive border-destructive/30 font-semibold">NO MATCH FOUND ❌</Badge>;
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

          {/* Bill-Level Summary & Unpaid Deliveries Breakdown */}
          {report.billSummary && report.billSummary.length > 0 && (
            <Card className="border-primary/20 bg-card shadow-sm">
              <CardHeader className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span>Bill-Level Payment Reconciliation</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {report.billSummary.length} Matched Annexure Bill{report.billSummary.length > 1 ? "s" : ""}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Summary of Annexure Bills identified from Payment Advice. Compares total bill items against paid advice items to detect unpaid deliveries.
                    </CardDescription>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleDownloadExcel}
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium gap-1.5 shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Bill Reconciliation Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.billSummary.map((b: any, idx: number) => {
                  const unpaidCount = b.unpaidAnnexureItemsCount || 0;
                  const totalCount = b.totalBillItems || b.deliveryCount || 0;
                  const paidCount = b.paidAdviceItemsCount || b.deliveryCount || 0;
                  const hasUnpaid = unpaidCount > 0;

                  return (
                    <div key={idx} className="border rounded-lg p-4 space-y-3 bg-background/50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-primary">{b.billNumber}</span>
                          {hasUnpaid ? (
                            <Badge variant="destructive" className="text-xs">
                              {unpaidCount} Unpaid Deliveries ({paidCount}/{totalCount} Paid)
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-600 text-white text-xs">
                              Fully Paid ({paidCount}/{totalCount} Deliveries)
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground">Bill Total: </span>
                            <span className="font-semibold">₹{(b.totalBillAmount || b.annexureBillAmt || 0).toLocaleString("en-IN")}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Advice Paid: </span>
                            <span className="font-semibold text-emerald-600">₹{(b.advicePaidAmt || 0).toLocaleString("en-IN")}</span>
                          </div>
                          {hasUnpaid && (
                            <div>
                              <span className="text-muted-foreground">Unpaid Value: </span>
                              <span className="font-bold text-destructive">₹{(b.unpaidAnnexureAmount || 0).toLocaleString("en-IN")}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Unpaid Items Table for this Bill */}
                      {hasUnpaid && b.unpaidItems && b.unpaidItems.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-bold text-destructive mb-2">
                            ⚠️ Deliveries in Bill {b.billNumber} NOT Received / NOT Paid in this Advice ({b.unpaidItems.length} items):
                          </p>
                          <div className="overflow-x-auto rounded border">
                            <Table className="text-xs">
                              <TableHeader className="bg-destructive/5">
                                <TableRow>
                                  <TableHead className="py-1.5 font-bold">Consignment / LR No</TableHead>
                                  <TableHead className="py-1.5 font-bold">Delivery No</TableHead>
                                  <TableHead className="py-1.5 font-bold">Invoice No (TSL)</TableHead>
                                  <TableHead className="py-1.5">Vehicle No</TableHead>
                                  <TableHead className="py-1.5">Consignee</TableHead>
                                  <TableHead className="py-1.5 text-right font-bold">Freight Base (₹)</TableHead>
                                  <TableHead className="py-1.5 text-right font-bold text-destructive">Unpaid Total (₹)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {b.unpaidItems.map((u: any, uIdx: number) => (
                                  <TableRow key={uIdx} className="bg-destructive/5 hover:bg-destructive/10">
                                    <TableCell className="py-1.5 font-semibold text-primary">{u.lrNumber || "-"}</TableCell>
                                    <TableCell className="py-1.5 font-mono">{u.deliveryNumber || "-"}</TableCell>
                                    <TableCell className="py-1.5 font-mono">{u.invoiceNumber || "-"}</TableCell>
                                    <TableCell className="py-1.5">{u.vehicleNumber || "-"}</TableCell>
                                    <TableCell className="py-1.5">{u.consigneeName || "-"}</TableCell>
                                    <TableCell className="py-1.5 text-right">₹{(u.freightBaseAmount || 0).toLocaleString("en-IN")}</TableCell>
                                    <TableCell className="py-1.5 text-right font-bold text-destructive">₹{(u.totalAmount || 0).toLocaleString("en-IN")}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

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
                  <Button
                    size="sm"
                    onClick={handleDownloadExcel}
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium gap-1.5 shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export to Excel
                  </Button>

                  <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <TabsList className="h-8 text-xs">
                      <TabsTrigger value="ALL" className="text-xs py-1 px-2.5">All ({report.totalAdviceItems})</TabsTrigger>
                      <TabsTrigger value="MATCHED" className="text-xs py-1 px-2.5">Matched ({matchedCount})</TabsTrigger>
                      <TabsTrigger value="DEDUCTION" className="text-xs py-1 px-2.5 text-purple-600 dark:text-purple-400 font-medium">Deductions ({report.items.filter(i => i.isDeduction || i.status === 'DEBIT_NOTE_DEDUCTION' || i.advicePaidAmount < 0).length})</TabsTrigger>
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
                      <TableHead className="py-2 whitespace-nowrap text-right text-blue-600 dark:text-blue-400 font-bold">TDS (2% Freight)</TableHead>
                      <TableHead className="py-2 whitespace-nowrap text-right text-emerald-600 dark:text-emerald-400 font-bold">Expected Payable (after TDS)</TableHead>
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
                      const freightBase = ann?.freightBaseAmount || item.freightBaseAmount || 0;
                      const tds2Pct = item.tdsAmount || (freightBase ? Math.round(freightBase * 0.02 * 100) / 100 : 0);
                      const expectedNetPay = item.expectedPayable || (item.annexureBillAmount ? Math.round((item.annexureBillAmount - tds2Pct) * 100) / 100 : 0);

                      return (
                        <TableRow key={idx} className={`hover:bg-muted/30 ${item.isDeduction || item.advicePaidAmount < 0 ? "bg-purple-500/5 dark:bg-purple-950/10" : ""}`}>
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
                            {freightBase ? `₹${freightBase.toLocaleString("en-IN")}` : "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-mono text-blue-600 dark:text-blue-400 font-semibold">
                            {tds2Pct > 0 ? `₹${tds2Pct.toLocaleString("en-IN")}` : "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            {expectedNetPay > 0 ? `₹${expectedNetPay.toLocaleString("en-IN")}` : "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-mono">
                            {taxSum > 0 ? `₹${taxSum.toLocaleString("en-IN")}` : "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-mono font-bold">
                            {item.annexureBillAmount ? `₹${item.annexureBillAmount.toLocaleString("en-IN")}` : "—"}
                          </TableCell>
                          <TableCell className={`text-right whitespace-nowrap font-mono font-bold ${item.advicePaidAmount < 0 ? "text-purple-600 dark:text-purple-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            ₹{item.advicePaidAmount.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className={`text-right whitespace-nowrap font-mono font-bold ${item.variance > 5 ? "text-destructive" : "text-emerald-600"}`}>
                            {item.variance ? `₹${item.variance.toLocaleString("en-IN")}` : "₹0"}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">{getStatusBadge(item.status, item.isDeduction || item.advicePaidAmount < 0)}</TableCell>
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
