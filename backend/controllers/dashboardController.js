import { Trip } from "../models/tripModel.js";
import {
  buildComputedFieldsStage,
  buildSummaryGroupStage,
  buildSummaryProjectStage,
  emptySummary,
} from "../services/aggregationService.js";
import { getDashboardCache, setDashboardCache } from "../services/dashboardCacheService.js";

function safeInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function buildMonthMatch({ month, year }) {
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  const y = Number.isFinite(year) ? year : new Date().getUTCFullYear();
  const start = new Date(Date.UTC(y, month - 1, 1));
  const end = new Date(Date.UTC(y, month, 1));
  return { loadingDate: { $gte: start, $lt: end } };
}

function cacheKey({ month, year, limit }) {
  return `${year || ""}-${month || ""}-${limit || ""}`;
}

function getCacheTtlMs({ month, year }) {
  const now = new Date();
  const curMonth = now.getUTCMonth() + 1;
  const curYear = now.getUTCFullYear();
  if (month === curMonth && year === curYear) return 2 * 60_000;
  return 30_000;
}

export async function getDashboard(req, res) {
  const month = safeInt(req.query.month);
  const year = safeInt(req.query.year);
  const limitRaw = safeInt(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(0, Math.min(500, limitRaw)) : 150;

  const key = cacheKey({ month, year, limit });
  const cached = getDashboardCache(key);
  if (cached) return res.json(cached);

  const match = buildMonthMatch({ month, year });
  const pipeline = [
    ...(match ? [{ $match: match }] : []),
    buildComputedFieldsStage(),
    {
      $facet: {
        summary: [buildSummaryGroupStage(), buildSummaryProjectStage()],
        trips: [
          { $sort: { loadingDate: -1 } },
          ...(limit > 0 ? [{ $limit: limit }] : []),
          {
            $project: {
              tripKey: 1,
              sno: 1,
              invoiceNumber: 1,
              deliveryNumber: 1,
              chassisNumber: 1,
              vehicleNumber: 1,
              vehicleSuffix: 1,
              tripType: 1,
              marketVehicleBookNumber: 1,
              partyType: 1,
              partyName: 1,
              tripNumber: 1,
              loadingDate: 1,
              unloadingDate: 1,
              challanDate: 1,
              loadingPoint: 1,
              unloadingPoint: 1,
              loadingWeightTons: 1,
              unloadingWeightTons: 1,
              shortageTons: 1,
              ratePerTon: 1,
              totalFreight: 1,
              cash: 1,
              cardAccount: 1,
              cashDate: 1,
              diesel: 1,
              pumpCard: 1,
              dieselDate: 1,
              fastag: 1,
              fastagDate: 1,
              totalAdvance: 1,
              otherExpenses: 1,
              billBookNumber: 1,
              marketPaymentDate: 1,
              remarks: 1,
              tripStatus: 1,
              computed: 1,
              sheet: 1,
            },
          },
        ],
      },
    },
  ];

  const [result] = await Trip.aggregate(pipeline);
  const summary = (result?.summary && result.summary[0]) || emptySummary();
  const trips = result?.trips || [];
  const payload = { summary, trips };

  setDashboardCache(key, payload, getCacheTtlMs({ month, year }));

  return res.json(payload);
}

