import { useState } from "react";
import { Trip } from "@/lib/mock-data";
import { TripDetailModal } from "@/components/TripDetailModal";
import { ArrowUpDown } from "lucide-react";

interface TripTableProps {
  trips: Trip[];
}

export function TripTable({ trips }: TripTableProps) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [sortKey, setSortKey] = useState<keyof Trip>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...trips].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
    return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const handleSort = (key: keyof Trip) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ label, field }: { label: string; field: keyof Trip }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </th>
  );

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <SortHeader label="Invoice" field="invoiceNumber" />
                <SortHeader label="Vehicle" field="vehicleNumber" />
                <SortHeader label="Date" field="date" />
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Route</th>
                <SortHeader label="Income" field="income" />
                <SortHeader label="Expenses" field="totalExpenses" />
                <SortHeader label="Profit" field="profit" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((trip) => (
                <tr
                  key={trip.id}
                  onClick={() => setSelectedTrip(trip)}
                  className="border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{trip.invoiceNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{trip.vehicleNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{trip.date}</td>
                  <td className="px-4 py-3 text-muted-foreground">{trip.loadingPoint} → {trip.unloadingPoint}</td>
                  <td className="px-4 py-3 font-medium">₹{trip.income.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-destructive">₹{trip.totalExpenses.toLocaleString("en-IN")}</td>
                  <td className={`px-4 py-3 font-semibold ${trip.profit >= 0 ? "text-success" : "text-destructive"}`}>
                    ₹{trip.profit.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No trips found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TripDetailModal trip={selectedTrip} open={!!selectedTrip} onClose={() => setSelectedTrip(null)} />
    </>
  );
}
