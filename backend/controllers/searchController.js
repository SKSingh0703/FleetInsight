import { searchTrips } from "../services/searchService.js";

export async function postSearch(req, res) {
  const filters = req.body && typeof req.body === "object" ? req.body : {};
  const { summary, trips } = await searchTrips(filters);
  return res.json({ summary, trips });
}
