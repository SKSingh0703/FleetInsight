import { Trip } from "../models/tripModel.js";
import {
  buildComputedFieldsStage,
  buildSummaryGroupStage,
  buildSummaryProjectStage,
  emptySummary,
} from "../services/aggregationService.js";

export async function getDashboard(req, res) {
  const pipeline = [
    buildComputedFieldsStage(),
    buildSummaryGroupStage(),
    buildSummaryProjectStage(),
  ];

  const result = await Trip.aggregate(pipeline);
  const summary = result && result[0] ? result[0] : emptySummary();
  return res.json({ summary, trips: [] });
}

