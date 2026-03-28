import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { mockTrips, mockVehicles, Trip, Vehicle } from "@/lib/mock-data";
import { FilterPanel, Filters } from "@/components/FilterPanel";
import { SummaryCard } from "@/components/SummaryCard";
import { TripTable } from "@/components/TripTable";
import { VehicleCard } from "@/components/VehicleCard";
import { Truck, IndianRupee, BarChart3, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

function normalizeVehicle(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

function matchVehicles(query: string): Vehicle[] {
  const q = normalizeVehicle(query);
  if (!q) return [];

  // Try exact match on invoice, book, chassis first
  const exactTrip = mockTrips.find(
    (t) => t.invoiceNumber.toUpperCase() === q || t.bookNumber.toUpperCase() === q || t.chassisNumber.toUpperCase() === q
  );
  if (exactTrip) {
    const v = mockVehicles.find((v) => v.vehicleNumber === exactTrip.vehicleNumber);
    return v ? [v] : [];
  }

  // Vehicle number matching - smart partial
  return mockVehicles.filter((v) => {
    const vn = v.vehicleNumber.toUpperCase();
    if (vn === q) return true;
    if (vn.includes(q)) return true;
    // Match trailing digits
    const digits = q.replace(/\D/g, "");
    if (digits && vn.endsWith(digits.padStart(4, "0"))) return true;
    return false;
  });
}

function getTripsForVehicle(vehicleNumber: string): Trip[] {
  return mockTrips.filter((t) => t.vehicleNumber === vehicleNumber);
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ tripType: "", partyType: "", dateFrom: "", dateTo: "" });

  const matchedVehicles = useMemo(() => matchVehicles(query), [query]);

  // If only 1 match, auto-select
  const activeVehicle = selectedVehicle || (matchedVehicles.length === 1 ? matchedVehicles[0].vehicleNumber : null);

  const filteredTrips = useMemo(() => {
    let trips = activeVehicle ? getTripsForVehicle(activeVehicle) : [];

    // Also check for exact invoice/book/chassis matches
    if (!activeVehicle && query) {
      const q = query.toUpperCase().trim();
      trips = mockTrips.filter(
        (t) =>
          t.invoiceNumber.toUpperCase().includes(q) ||
          t.bookNumber.toUpperCase().includes(q) ||
          t.chassisNumber.toUpperCase().includes(q)
      );
    }

    if (filters.tripType) trips = trips.filter((t) => t.tripType === filters.tripType);
    if (filters.partyType) trips = trips.filter((t) => t.partyType === filters.partyType);
    if (filters.dateFrom) trips = trips.filter((t) => t.date >= filters.dateFrom);
    if (filters.dateTo) trips = trips.filter((t) => t.date <= filters.dateTo);

    return trips;
  }, [activeVehicle, query, filters]);

  const totalIncome = filteredTrips.reduce((s, t) => s + t.income, 0);
  const totalExpenses = filteredTrips.reduce((s, t) => s + t.totalExpenses, 0);
  const totalProfit = totalIncome - totalExpenses;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedVehicle(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground mt-1">Find vehicles, invoices, and trip records</p>
      </div>

      {/* Search input */}
      <form onSubmit={handleSearch} className="search-bar-global max-w-2xl">
        <SearchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedVehicle(null); }}
          placeholder="Search by vehicle number, invoice, chassis, or book number..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoFocus
        />
      </form>

      {/* Filters */}
      <FilterPanel filters={filters} onChange={setFilters} />

      {/* Results */}
      {query && !activeVehicle && matchedVehicles.length > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            {matchedVehicles.length} vehicles matched
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {matchedVehicles.map((v, i) => (
              <VehicleCard
                key={v.vehicleNumber}
                vehicle={v}
                index={i}
                onClick={() => setSelectedVehicle(v.vehicleNumber)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {query && matchedVehicles.length === 0 && filteredTrips.length === 0 && (
        <div className="text-center py-16">
          <SearchIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No results found for "{query}"</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different search term or adjust filters</p>
        </div>
      )}

      {(activeVehicle || filteredTrips.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {activeVehicle && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedVehicle(null)}
                className="text-xs text-primary hover:underline"
              >
                ← All results
              </button>
              <span className="text-xs text-muted-foreground">/ {activeVehicle}</span>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="Trips" value={filteredTrips.length.toString()} icon={Truck} />
            <SummaryCard title="Income" value={`₹${totalIncome.toLocaleString("en-IN")}`} icon={IndianRupee} variant="income" />
            <SummaryCard title="Expenses" value={`₹${totalExpenses.toLocaleString("en-IN")}`} icon={BarChart3} variant="expense" />
            <SummaryCard title="Profit" value={`₹${totalProfit.toLocaleString("en-IN")}`} icon={TrendingUp} variant="profit" />
          </div>

          <TripTable trips={filteredTrips} />
        </motion.div>
      )}

      {!query && (
        <div className="text-center py-16">
          <SearchIcon className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground">Start typing to search</p>
          <p className="text-xs text-muted-foreground mt-1">Search by vehicle number (e.g. 28, 0028, JH05AC0028), invoice, chassis, or book number</p>
        </div>
      )}
    </div>
  );
}
