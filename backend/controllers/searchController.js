import { searchTrips } from "../services/searchService.js";

export async function postSearch(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};

  const limit = Number.isFinite(Number(body.limit)) ? Number(body.limit) : undefined;
  const skip = Number.isFinite(Number(body.skip)) ? Number(body.skip) : undefined;

  const { limit: _limit, skip: _skip, ...filters } = body;

  const { summary, trips } = await searchTrips(filters, {
    ...(typeof limit === "number" ? { limit } : {}),
    ...(typeof skip === "number" ? { skip } : {}),
  });
  return res.json({ summary, trips });
}
