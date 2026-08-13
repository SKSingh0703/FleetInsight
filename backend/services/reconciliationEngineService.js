import crypto from "crypto";
import { AnnexureRecord } from "../models/annexureRecordModel.js";
import { PaymentAdviceRecord } from "../models/paymentAdviceRecordModel.js";
import { ReconciliationResult } from "../models/reconciliationResultModel.js";

function cleanToken(val) {
  if (val == null) return "";
  let s = String(val).trim().toUpperCase();
  if (/^\d+\.0$/.test(s)) s = s.slice(0, -2);
  return s;
}

function extractCoreBill(val) {
  if (!val) return "";
  let s = cleanToken(val);
  const m = s.match(/^[A-Z]+[\/\-_](.+)$/);
  return m ? m[1] : s;
}

export async function runReconciliation() {
  const annexures = await AnnexureRecord.find({}).lean();
  const advices = await PaymentAdviceRecord.find({}).lean();

  const matchedAdviceIds = new Set();
  const resultsToSave = [];

  // Index advices by matching keys for fast lookup
  const adviceByDelivery = new Map();
  const adviceByInvoice = new Map();
  const adviceByVehicle = new Map();
  const adviceByBill = new Map();
  const adviceByCoreBill = new Map();
  const adviceByDocNo = new Map();

  for (const adv of advices) {
    const del = cleanToken(adv.deliveryNumber);
    const inv = cleanToken(adv.invoiceNumber);
    const veh = cleanToken(adv.vehicleNumber);
    const bill = cleanToken(adv.billNumber);
    const docNo = cleanToken(adv.documentNumber);

    const coreInv = extractCoreBill(adv.invoiceNumber);
    const coreBill = extractCoreBill(adv.billNumber);

    if (del && !adviceByDelivery.has(del)) adviceByDelivery.set(del, adv);
    if (inv && !adviceByInvoice.has(inv)) adviceByInvoice.set(inv, adv);
    if (veh && !adviceByVehicle.has(veh)) adviceByVehicle.set(veh, adv);
    if (bill && !adviceByBill.has(bill)) adviceByBill.set(bill, adv);
    if (docNo && !adviceByDocNo.has(docNo)) adviceByDocNo.set(docNo, adv);

    if (coreInv && !adviceByCoreBill.has(coreInv)) adviceByCoreBill.set(coreInv, adv);
    if (coreBill && !adviceByCoreBill.has(coreBill)) adviceByCoreBill.set(coreBill, adv);
  }

  // Phase 1: Reconcile each Annexure record against Payment Advices using Priority Order
  for (const ann of annexures) {
    const del = cleanToken(ann.deliveryNumber);
    const inv = cleanToken(ann.invoiceNumber);
    const veh = cleanToken(ann.vehicleNumber);
    const bill = cleanToken(ann.billNumber);

    const coreInv = extractCoreBill(ann.invoiceNumber);
    const coreBill = extractCoreBill(ann.billNumber);
    const docNo = cleanToken(ann.documentNumber || ann.raw?.documentNumber || ann.raw?.["FI Document No Details"] || ann.raw?.["Document Number"]);

    let match = null;
    let priority = "UNMATCHED";
    let reason = "No matching Payment Advice found";

    if (del && adviceByDelivery.has(del)) {
      match = adviceByDelivery.get(del);
      priority = "1_DELIVERY_NUMBER";
      reason = `Matched by Delivery Number: ${del}`;
    } else if (inv && adviceByInvoice.has(inv)) {
      match = adviceByInvoice.get(inv);
      priority = "2_INVOICE_NUMBER";
      reason = `Matched by Invoice Number: ${inv}`;
    } else if (bill && adviceByBill.has(bill)) {
      match = adviceByBill.get(bill);
      priority = "3_BILL_NUMBER";
      reason = `Matched by Bill Number: ${bill}`;
    } else if (coreBill && adviceByCoreBill.has(coreBill)) {
      match = adviceByCoreBill.get(coreBill);
      priority = "4_CORE_BILL_NUMBER";
      reason = `Matched by Core Bill Reference: ${coreBill}`;
    } else if (coreInv && adviceByCoreBill.has(coreInv)) {
      match = adviceByCoreBill.get(coreInv);
      priority = "4_CORE_BILL_NUMBER";
      reason = `Matched by Core Invoice Reference: ${coreInv}`;
    } else if (docNo && adviceByDocNo.has(docNo)) {
      match = adviceByDocNo.get(docNo);
      priority = "5_DOCUMENT_NUMBER";
      reason = `Matched by Document Number: ${docNo}`;
    } else if (veh && adviceByVehicle.has(veh)) {
      match = adviceByVehicle.get(veh);
      priority = "6_VEHICLE_NUMBER";
      reason = `Matched by Vehicle Number: ${veh}`;
    }

    const reconKeyPayload = `${ann.annexureKey}:${match ? match.adviceKey : "unmatched"}`;
    const reconKey = crypto.createHash("sha256").update(reconKeyPayload).digest("hex");

    if (match) {
      matchedAdviceIds.add(String(match._id));

      const annexureAmt = Number(ann.totalAmount || ann.freightBaseAmount || 0);
      const paymentNet = Number(match.netAmount || match.grossAmount || 0);
      const variance = Number((annexureAmt - paymentNet).toFixed(2));

      let status = "MATCHED";
      if (Math.abs(variance) <= 0.01) {
        status = "MATCHED";
      } else if (variance > 0) {
        status = "SHORT_PAID";
      } else {
        status = "EXCESS_PAID";
      }

      resultsToSave.push({
        reconKey,
        status,
        matchPriority: priority,
        matchReason: reason,

        annexureKey: ann.annexureKey,
        annexureId: ann._id,

        adviceKey: match.adviceKey,
        adviceId: match._id,

        billNumber: ann.billNumber || match.billNumber || "",
        invoiceNumber: ann.invoiceNumber || match.invoiceNumber || "",
        deliveryNumber: ann.deliveryNumber || match.deliveryNumber || "",
        vehicleNumber: ann.vehicleNumber || match.vehicleNumber || "",
        vehicleSuffix: ann.vehicleSuffix || match.vehicleSuffix || "",
        lrNumber: ann.lrNumber || "",

        annexureFreightAmount: ann.freightBaseAmount || 0,
        annexureTotalAmount: annexureAmt,

        paymentGrossAmount: match.grossAmount || 0,
        paymentDeductionAmount: match.deductionAmount || 0,
        paymentNetAmount: paymentNet,
        varianceAmount: variance,

        annexureFileName: ann.fileName || "",
        annexureFolderPath: ann.billFolderPath || "",
        adviceFileName: match.fileName || "",
        adviceDocNo: match.paymentDocNo || "",
        financialYear: ann.financialYear || "2026-27",
      });
    } else {
      const annexureAmt = Number(ann.totalAmount || ann.freightBaseAmount || 0);
      resultsToSave.push({
        reconKey,
        status: "MISSING_IN_PAYMENT_ADVICE",
        matchPriority: "UNMATCHED",
        matchReason: "Annexure row has no matching Payment Advice entry",

        annexureKey: ann.annexureKey,
        annexureId: ann._id,

        billNumber: ann.billNumber || "",
        invoiceNumber: ann.invoiceNumber || "",
        deliveryNumber: ann.deliveryNumber || "",
        vehicleNumber: ann.vehicleNumber || "",
        vehicleSuffix: ann.vehicleSuffix || "",
        lrNumber: ann.lrNumber || "",

        annexureFreightAmount: ann.freightBaseAmount || 0,
        annexureTotalAmount: annexureAmt,

        paymentGrossAmount: 0,
        paymentDeductionAmount: 0,
        paymentNetAmount: 0,
        varianceAmount: annexureAmt,

        annexureFileName: ann.fileName || "",
        annexureFolderPath: ann.billFolderPath || "",
        financialYear: ann.financialYear || "2026-27",
      });
    }
  }

  // Phase 2: Identify Payment Advices that had no matching Annexure record
  for (const adv of advices) {
    if (!matchedAdviceIds.has(String(adv._id))) {
      const reconKeyPayload = `missing_annexure:${adv.adviceKey}`;
      const reconKey = crypto.createHash("sha256").update(reconKeyPayload).digest("hex");
      const paymentNet = Number(adv.netAmount || adv.grossAmount || 0);

      resultsToSave.push({
        reconKey,
        status: "MISSING_IN_ANNEXURE",
        matchPriority: "UNMATCHED",
        matchReason: "Payment Advice line has no matching Annexure entry",

        adviceKey: adv.adviceKey,
        adviceId: adv._id,

        billNumber: adv.billNumber || "",
        invoiceNumber: adv.invoiceNumber || "",
        deliveryNumber: adv.deliveryNumber || "",
        vehicleNumber: adv.vehicleNumber || "",
        vehicleSuffix: adv.vehicleSuffix || "",

        annexureFreightAmount: 0,
        annexureTotalAmount: 0,

        paymentGrossAmount: adv.grossAmount || 0,
        paymentDeductionAmount: adv.deductionAmount || 0,
        paymentNetAmount: paymentNet,
        varianceAmount: -paymentNet,

        adviceFileName: adv.fileName || "",
        adviceDocNo: adv.paymentDocNo || "",
        financialYear: "2026-27",
      });
    }
  }

  // Bulk upsert results
  if (resultsToSave.length > 0) {
    await ReconciliationResult.deleteMany({});
    const ops = resultsToSave.map((rec) => ({
      updateOne: {
        filter: { reconKey: rec.reconKey },
        update: { $set: rec },
        upsert: true,
      },
    }));
    await ReconciliationResult.bulkWrite(ops, { ordered: false });
  }

  return getReconciliationSummaryInternal();
}

export async function getReconciliationSummaryInternal() {
  const total = await ReconciliationResult.countDocuments({});
  const matched = await ReconciliationResult.countDocuments({ status: "MATCHED" });
  const shortPaid = await ReconciliationResult.countDocuments({ status: "SHORT_PAID" });
  const excessPaid = await ReconciliationResult.countDocuments({ status: "EXCESS_PAID" });
  const missingInAdvice = await ReconciliationResult.countDocuments({ status: "MISSING_IN_PAYMENT_ADVICE" });
  const missingInAnnexure = await ReconciliationResult.countDocuments({ status: "MISSING_IN_ANNEXURE" });

  // Bill-wise Summary
  const billWiseAgg = await ReconciliationResult.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$billNumber", "UNASSIGNED"] },
        totalRecords: { $sum: 1 },
        matchedCount: {
          $sum: { $cond: [{ $eq: ["$status", "MATCHED"] }, 1, 0] },
        },
        shortPaidCount: {
          $sum: { $cond: [{ $eq: ["$status", "SHORT_PAID"] }, 1, 0] },
        },
        totalAnnexureAmount: { $sum: "$annexureTotalAmount" },
        totalPaymentNetAmount: { $sum: "$paymentNetAmount" },
        totalVariance: { $sum: "$varianceAmount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    total,
    matched,
    shortPaid,
    excessPaid,
    missingInAdvice,
    missingInAnnexure,
    billWiseSummary: billWiseAgg.map((b) => ({
      billNumber: b._id,
      totalRecords: b.totalRecords,
      matchedCount: b.matchedCount,
      shortPaidCount: b.shortPaidCount,
      totalAnnexureAmount: b.totalAnnexureAmount,
      totalPaymentNetAmount: b.totalPaymentNetAmount,
      totalVariance: b.totalVariance,
    })),
  };
}
