export function buildComputedFieldsStage() {
  const computedWeightExpr = {
    $cond: [
      { $gt: [{ $ifNull: ["$unloadingWeightTons", 0] }, 0] },
      { $ifNull: ["$unloadingWeightTons", 0] },
      { $ifNull: ["$loadingWeightTons", 0] },
    ],
  };

  const computedRevenueExpr = {
    $cond: [
      { $gt: [{ $ifNull: ["$ratePerTon", 0] }, 0] },
      { $multiply: [computedWeightExpr, { $ifNull: ["$ratePerTon", 0] }] },
      0,
    ],
  };

  // If totalFreight is explicitly provided (non-zero), prefer it. Otherwise compute.
  const revenueExpr = {
    $cond: [
      { $gt: [{ $ifNull: ["$totalFreight", 0] }, 0] },
      { $ifNull: ["$totalFreight", 0] },
      computedRevenueExpr,
    ],
  };

  const shortageTonsExpr = { $ifNull: ["$shortageTons", 0] };

  const shortageCostExpr = {
    $multiply: [shortageTonsExpr, { $ifNull: ["$ratePerTon", 0] }],
  };

  const explicitExpensesExpr = {
    $add: [
      { $ifNull: ["$cash", 0] },
      { $ifNull: ["$diesel", 0] },
      { $ifNull: ["$otherExpenses", 0] },
    ],
  };

  const totalExpensesExpr = { $add: [explicitExpensesExpr, shortageCostExpr] };
  const profitExpr = { $subtract: [revenueExpr, totalExpensesExpr] };

  return {
    $addFields: {
      computed: {
        revenue: revenueExpr,
        shortageTons: shortageTonsExpr,
        shortageCost: shortageCostExpr,
        totalExpenses: totalExpensesExpr,
        profit: profitExpr,
      },
    },
  };
}

export function buildSummaryGroupStage() {
  return {
    $group: {
      _id: null,
      totalTrips: { $sum: 1 },
      totalRevenue: { $sum: "$computed.revenue" },
      totalExpenses: { $sum: "$computed.totalExpenses" },
      totalProfit: { $sum: "$computed.profit" },
    },
  };
}

export function buildSummaryProjectStage() {
  return {
    $project: {
      _id: 0,
      totalTrips: 1,
      totalRevenue: 1,
      totalExpenses: 1,
      totalProfit: 1,
    },
  };
}

export function emptySummary() {
  return { totalTrips: 0, totalRevenue: 0, totalExpenses: 0, totalProfit: 0 };
}
