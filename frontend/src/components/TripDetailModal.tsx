import type { UiTrip as Trip } from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Calendar, Weight, IndianRupee, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ElementType } from "react";

function formatUnknown(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toKeyValueRows(obj: Record<string, unknown> | undefined) {
  const entries = Object.entries(obj || {});
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return entries;
}

function isNonEmpty(value: string | undefined | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatTonnes(value: number) {
  return `${value} t`;
}

interface TripDetailModalProps {
  trip: Trip | null;
  open: boolean;
  onClose: () => void;
}

export function TripDetailModal({ trip, open, onClose }: TripDetailModalProps) {
  if (!trip) return null;

  const raw = trip.raw;
  const extensions = (raw?.extensions || {}) as Record<string, unknown>;
  const sheetRaw = (raw?.sheet?.raw || {}) as Record<string, unknown>;
  const sheetNormalized = (raw?.sheet?.normalized || {}) as Record<string, unknown>;
  const unloadingWeightAssumed = extensions.unloadingWeightAssumed === true;

  const loadingWeightTons = raw?.loading?.weightTons;
  const unloadingWeightTons = raw?.unloading?.weightTons;
  const shortageTons = raw?.computed?.shortageTons;
  const totalFreight = raw?.computed?.revenue;

  const computedShortageTons =
    isFiniteNumber(loadingWeightTons) && isFiniteNumber(unloadingWeightTons)
      ? Number((loadingWeightTons - unloadingWeightTons).toFixed(3))
      : undefined;

  const effectiveShortageTons = isFiniteNumber(shortageTons) ? shortageTons : computedShortageTons;

  const computedFreight =
    isFiniteNumber(unloadingWeightTons) && Number.isFinite(trip.rate)
      ? Number((unloadingWeightTons * trip.rate).toFixed(2))
      : undefined;

  const effectiveFreight = isFiniteNumber(totalFreight) ? totalFreight : computedFreight;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {trip.invoiceNumber || trip.tripKey || trip.vehicleNumber}
            <Badge variant={trip.tripType === "OWN" ? "default" : "secondary"}>
              {trip.tripType}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Route */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">{trip.loadingPoint} → {trip.unloadingPoint}</p>
              {(isNonEmpty(trip.partyName) && trip.partyName !== "UNKNOWN") && (
                <p className="text-xs text-muted-foreground">{trip.partyName} · {trip.partyType}</p>
              )}
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            <DetailItem icon={CircleDot} label="Vehicle No." value={trip.vehicleNumber} />
            <DetailItem
              icon={CircleDot}
              label="Party"
              value={
                trip.partyName && trip.partyName !== "UNKNOWN"
                  ? `${trip.partyType} · ${trip.partyName}`
                  : trip.partyType
              }
            />
            <DetailItem icon={Calendar} label="Loading Date" value={trip.loadingDate} />
            <DetailItem icon={Calendar} label="Unloading Date" value={trip.unloadingDate} />
            {isFiniteNumber(loadingWeightTons) && (
              <DetailItem icon={Weight} label="Loading Wt" value={formatTonnes(loadingWeightTons)} />
            )}
            {isFiniteNumber(unloadingWeightTons) && (
              <DetailItem
                icon={Weight}
                label="Unloading Wt"
                value={`${formatTonnes(unloadingWeightTons)}${unloadingWeightAssumed ? " (assumed)" : ""}`}
              />
            )}
            {isFiniteNumber(effectiveShortageTons) && effectiveShortageTons > 0 && (
              <DetailItem icon={Weight} label="Shortage" value={formatTonnes(effectiveShortageTons)} />
            )}
            {isFiniteNumber(effectiveFreight) && (
              <DetailItem icon={IndianRupee} label="Total Freight" value={`₹${effectiveFreight.toLocaleString("en-IN")}`} />
            )}
            <DetailItem icon={IndianRupee} label="Rate" value={`₹${trip.rate.toLocaleString("en-IN")}`} />
            {isNonEmpty(trip.bookNumber) && (
              <DetailItem icon={CircleDot} label="Book No." value={trip.bookNumber} />
            )}
            {isNonEmpty(trip.chassisNumber) && (
              <DetailItem icon={CircleDot} label="Chassis No." value={trip.chassisNumber} />
            )}
            {isNonEmpty(raw?.tripKey) && (
              <DetailItem icon={CircleDot} label="Trip Key" value={raw.tripKey} />
            )}
          </div>

          {/* Financials */}
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-semibold font-display mb-3">Financial Summary</p>
            <FinRow label="Income" value={trip.income} variant="income" />
            <FinRow label="Diesel" value={trip.diesel} />
            <FinRow label="Toll" value={trip.toll} />
            <FinRow label="Driver Bhatta" value={trip.driverBhatta} />
            <FinRow label="Other Expenses" value={trip.otherExpenses} />
            <div className="border-t pt-2 mt-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Profit</span>
              <span className={`text-sm font-bold ${trip.profit >= 0 ? "text-success" : "text-destructive"}`}>
                ₹{trip.profit.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {(Object.keys(sheetRaw).length > 0 || Object.keys(sheetNormalized).length > 0) && (
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer text-sm font-semibold font-display">Full Entry</summary>
              <div className="mt-3 space-y-4">
                {Object.keys(sheetRaw).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Raw (original headers)</p>
                    <KeyValueTable rows={toKeyValueRows(sheetRaw)} />
                  </div>
                )}
                {Object.keys(sheetNormalized).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Normalized (future-proof keys)</p>
                    <KeyValueTable rows={toKeyValueRows(sheetNormalized)} />
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KeyValueTable({ rows }: { rows: Array<[string, unknown]> }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="overflow-auto rounded-md border mt-3">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr className="text-muted-foreground">
            <th className="px-3 py-2 text-left">Key</th>
            <th className="px-3 py-2 text-left">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t">
              <td className="px-3 py-2 whitespace-nowrap font-medium">{k}</td>
              <td className="px-3 py-2 break-words">{formatUnknown(v) || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function FinRow({ label, value, variant }: { label: string; value: number; variant?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={variant === "income" ? "font-medium text-primary" : ""}>
        ₹{value.toLocaleString("en-IN")}
      </span>
    </div>
  );
}
