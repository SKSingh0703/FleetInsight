export function buildComputedFieldsStage() {
  const revenueExpr = {
    $multiply: [
      { $ifNull: ["$unloading.weightTons", 0] },
      { $ifNull: ["$ratePerTon", 0] },
    ],
  };

  const shortageTonsExpr = {
    $subtract: [
      { $ifNull: ["$loading.weightTons", 0] },
      { $ifNull: ["$unloading.weightTons", 0] },
    ],
  };

  const shortageCostExpr = {
    $multiply: [shortageTonsExpr, { $ifNull: ["$ratePerTon", 0] }],
  };

  const explicitExpensesExpr = {
    $add: [
      { $ifNull: ["$expenses.cash", 0] },
      { $ifNull: ["$expenses.diesel", 0] },
      { $ifNull: ["$expenses.other", 0] },
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
