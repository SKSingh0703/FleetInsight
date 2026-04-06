import { useCallback, useMemo, useState } from "react";
import type { UiTrip as Trip } from "@/services/api";
import { TripDetailModal } from "@/components/TripDetailModal";

function formatCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function compareUnknown(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  const an = typeof a === "number" ? a : Number.NaN;
  const bn = typeof b === "number" ? b : Number.NaN;
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;

  return formatCell(a).localeCompare(formatCell(b));
}

interface ExcelTripTableProps {
  trips: Trip[];
}

export function ExcelTripTable({ trips }: ExcelTripTableProps) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const DEFAULT_JHARKHAND_DIESEL_PRICE_PER_LITER = 93.5;

  const isTotalFreightColumn = useCallback((k: string) => {
    const n = String(k).trim().toLowerCase();
    return n === "t.f." || n === "t.f" || n === "tf" || n === "total freight";
  }, []);

  const isTotalAdvanceColumn = useCallback((k: string) => {
    const n = String(k)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\./g, "");
    return n === "total adv" || n === "total adv " || n === "total advance";
  }, []);

  const isDieselColumn = useCallback((k: string) => {
    const n = String(k).trim().toLowerCase().replace(/\s+/g, " ").replace(/\./g, "");
    return n === "diesel" || n === "dieselp" || n === "diesel p";
  }, []);

  const parseDieselCost = useCallback(
    (value: unknown) => {
      if (value == null) return 0;

      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
        const hasLitersUnit = /\b(ltr|litre|liter|liters|litres|l)\b/.test(normalized);
        if (hasLitersUnit) {
          const m = normalized.match(/-?\d+(?:\.\d+)?/);
          const liters = m ? Number(m[0]) : Number.NaN;
          if (Number.isFinite(liters) && liters >= 0) return liters * DEFAULT_JHARKHAND_DIESEL_PRICE_PER_LITER;
          return 0;
        }

        const cleaned = normalized.replace(/,/g, "");
        const n = Number(cleaned);
        if (!Number.isFinite(n) || n < 0) return 0;
        if (n > 0 && n <= 300) return n * DEFAULT_JHARKHAND_DIESEL_PRICE_PER_LITER;
        return n;
      }

      if (typeof value === "number" && Number.isFinite(value)) {
        if (value > 0 && value <= 300) return value * DEFAULT_JHARKHAND_DIESEL_PRICE_PER_LITER;
        return value;
      }

      return 0;
    },
    [DEFAULT_JHARKHAND_DIESEL_PRICE_PER_LITER]
  );

  const resolveCellValue = useCallback(
    (trip: Trip, k: string) => {
      const raw = (trip.raw?.sheet?.raw || {}) as Record<string, unknown>;
      const v = raw[k];

      if (isTotalFreightColumn(k)) {
        const hasSheetValue = v != null && String(v).trim() !== "";
        if (!hasSheetValue && typeof trip.totalFreight === "number" && Number.isFinite(trip.totalFreight)) {
          return trip.totalFreight;
        }
      }

      if (isDieselColumn(k)) {
        const hasSheetValue = v != null && String(v).trim() !== "";
        const candidate = hasSheetValue ? v : (trip.raw as { diesel?: unknown } | undefined)?.diesel;
        return parseDieselCost(candidate);
      }

      if (isTotalAdvanceColumn(k)) {
        const asNumber =
          typeof v === "number"
            ? v
            : typeof v === "string"
              ? Number(v.replace(/,/g, "").trim())
              : Number.NaN;

        if (Number.isFinite(asNumber)) return asNumber;

        const t = trip.raw as
          | {
              cash?: unknown;
              otherExpenses?: unknown;
              fastag?: unknown;
              diesel?: unknown;
              sheet?: { raw?: Record<string, unknown> };
            }
          | undefined;

        const cash = typeof t?.cash === "number" && Number.isFinite(t.cash) ? t.cash : 0;
        const other = typeof t?.otherExpenses === "number" && Number.isFinite(t.otherExpenses) ? t.otherExpenses : 0;
        const fastag = typeof t?.fastag === "number" && Number.isFinite(t.fastag) ? t.fastag : 0;

        const dieselKey = Object.keys(raw).find((key) => isDieselColumn(key));
        const dieselCandidate = dieselKey ? raw[dieselKey] : t?.diesel;
        const diesel = parseDieselCost(dieselCandidate);

        return cash + other + fastag + diesel;
      }

      return v;
    },
    [isDieselColumn, isTotalAdvanceColumn, isTotalFreightColumn, parseDieselCost]
  );

  const formatResolvedCell = useCallback(
    (trip: Trip, k: string) => {
      const v = resolveCellValue(trip, k);
      if (isTotalFreightColumn(k) && typeof v === "number" && Number.isFinite(v)) {
        return v.toLocaleString("en-IN");
      }
      if (isDieselColumn(k) && typeof v === "number" && Number.isFinite(v)) {
        return v.toLocaleString("en-IN");
      }
      if (isTotalAdvanceColumn(k) && typeof v === "number" && Number.isFinite(v)) {
        return v.toLocaleString("en-IN");
      }
      return formatCell(v);
    },
    [isDieselColumn, isTotalAdvanceColumn, isTotalFreightColumn, resolveCellValue]
  );

  const columns = useMemo(() => {
    if (!trips || trips.length === 0) return [];

    let templateRaw: Record<string, unknown> | null = null;
    let maxKeys = -1;

    for (const t of trips) {
      const raw = (t.raw?.sheet?.raw || {}) as Record<string, unknown>;
      const keyCount = Object.keys(raw).length;
      if (keyCount > maxKeys) {
        maxKeys = keyCount;
        templateRaw = raw;
      }
    }

    const templateKeys = templateRaw ? Object.keys(templateRaw) : [];
    if (templateKeys.length > 0) {
      const out = [...templateKeys];
      const seen = new Set<string>(templateKeys);

      for (const t of trips) {
        const raw = (t.raw?.sheet?.raw || {}) as Record<string, unknown>;
        for (const k of Object.keys(raw)) {
          if (seen.has(k)) continue;
          seen.add(k);
          out.push(k);
        }
      }

      return out;
    }

    const out: string[] = [];
    const seen = new Set<string>();

    for (const t of trips) {
      const raw = (t.raw?.sheet?.raw || {}) as Record<string, unknown>;
      for (const k of Object.keys(raw)) {
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(k);
      }
    }

    return out;
  }, [trips]);

  const sorted = useMemo(() => {
    if (!sortKey) {
      const rows = [...trips];
      rows.sort((a, b) => {
        const ad = a.loadingDate ? new Date(a.loadingDate).getTime() : Number.NEGATIVE_INFINITY;
        const bd = b.loadingDate ? new Date(b.loadingDate).getTime() : Number.NEGATIVE_INFINITY;

        if (Number.isFinite(ad) && Number.isFinite(bd) && ad !== bd) return bd - ad;

        const asno = Number((a.raw as { sno?: unknown } | undefined)?.sno ?? a.raw?.sheet?.raw?.["S.NO."] ?? a.raw?.sheet?.raw?.["S.NO"] ?? 0);
        const bsno = Number((b.raw as { sno?: unknown } | undefined)?.sno ?? b.raw?.sheet?.raw?.["S.NO."] ?? b.raw?.sheet?.raw?.["S.NO"] ?? 0);

        const an = Number.isFinite(asno) ? asno : 0;
        const bn = Number.isFinite(bsno) ? bsno : 0;
        return bn - an;
      });
      return rows;
    }

    const rows = [...trips];
    rows.sort((a, b) => {
      const ar = (a.raw?.sheet?.raw || {}) as Record<string, unknown>;
      const br = (b.raw?.sheet?.raw || {}) as Record<string, unknown>;

      const av = isTotalFreightColumn(sortKey) ? resolveCellValue(a, sortKey) : ar[sortKey];
      const bv = isTotalFreightColumn(sortKey) ? resolveCellValue(b, sortKey) : br[sortKey];
      const c = compareUnknown(av, bv);
      return sortAsc ? c : -c;
    });
    return rows;
  }, [isTotalFreightColumn, resolveCellValue, sortAsc, sortKey, trips]);

  const handleSort = (k: string) => {
    if (sortKey === k) setSortAsc((v) => !v);
    else {
      setSortKey(k);
      setSortAsc(true);
    }
  };

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {columns.map((k) => (
                  <th
                    key={k}
                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                    onClick={() => handleSort(k)}
                    title={k}
                  >
                    {isDieselColumn(k) ? "DIESEL (LTR)" : k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((trip) => {
                const raw = (trip.raw?.sheet?.raw || {}) as Record<string, unknown>;
                return (
                  <tr
                    key={trip.id}
                    onClick={() => setSelectedTrip(trip)}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    {columns.map((k) => {
                      const resolved = resolveCellValue(trip, k);
                      const numeric =
                        typeof resolved === "number"
                          ? resolved
                          : typeof resolved === "string"
                            ? Number(resolved.replace(/,/g, ""))
                            : Number.NaN;

                      const highlightTotalAdv = isTotalAdvanceColumn(k) && Number.isFinite(numeric) && numeric > 3000;

                      return (
                        <td
                          key={k}
                          className={
                            highlightTotalAdv
                              ? "px-3 py-2 whitespace-nowrap font-medium text-destructive bg-destructive/10"
                              : "px-3 py-2 text-muted-foreground whitespace-nowrap"
                          }
                        >
                          {formatResolvedCell(trip, k)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)} className="px-4 py-12 text-center text-muted-foreground">
                    No trips found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TripDetailModal trip={selectedTrip} open={!!selectedTrip} onClose={() => setSelectedTrip(null)} />
    </>
  );
}
