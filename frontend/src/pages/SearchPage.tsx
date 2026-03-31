import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { FilterPanel, Filters } from "@/components/FilterPanel";
import { SummaryCard } from "@/components/SummaryCard";
import { TripTable } from "@/components/TripTable";
import { VehicleCard } from "@/components/VehicleCard";
import { Truck, IndianRupee, BarChart3, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { buildVehicleSummaries, postSearch, toUiTrip } from "@/services/api";
import type { SearchFilters } from "@/services/api";

type SearchType =
  | "vehicleNumber"
  | "invoiceNumber"
  | "chassisNumber"
  | "bookNumber"
  | "tripKey"
  | "partyName"
  | "loadingPoint"
  | "unloadingPoint";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [searchType, setSearchType] = useState<SearchType>("vehicleNumber");
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  const defaultTripFrom = useMemo(() => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return d.toISOString().slice(0, 10);
  }, []);

  const defaultTripTo = useMemo(() => {
    const now = new Date();
    const startNext = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const end = new Date(startNext.getTime() - 24 * 60 * 60 * 1000);
    return end.toISOString().slice(0, 10);
  }, []);

  const [tripFrom, setTripFrom] = useState(defaultTripFrom);
  const [tripTo, setTripTo] = useState(defaultTripTo);
  const [filters, setFilters] = useState<Filters>({
    tripType: "",
    partyType: "",
    loadingFrom: "",
    loadingTo: "",
    unloadingFrom: "",
    unloadingTo: "",
  });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const apiFilters = useMemo(() => {
    const out: Partial<SearchFilters> = {};

    const q = debouncedQuery.trim();
    if (q) out[searchType] = q;

    if (filters.tripType) out.tripType = filters.tripType as SearchFilters["tripType"];
    if (filters.partyType) out.partyType = filters.partyType as SearchFilters["partyType"];

    if (tripFrom || tripTo) {
      out.tripDateRange = {
        ...(tripFrom ? { from: tripFrom } : {}),
        ...(tripTo ? { to: tripTo } : {}),
      };
    }

    if (filters.loadingFrom || filters.loadingTo) {
      out.dateRange = {
        ...(filters.loadingFrom ? { from: filters.loadingFrom } : {}),
        ...(filters.loadingTo ? { to: filters.loadingTo } : {}),
      };
    }

    if (filters.unloadingFrom || filters.unloadingTo) {
      out.unloadingDateRange = {
        ...(filters.unloadingFrom ? { from: filters.unloadingFrom } : {}),
        ...(filters.unloadingTo ? { to: filters.unloadingTo } : {}),
      };
    }

    return out;
  }, [debouncedQuery, filters, searchType, tripFrom, tripTo]);

  const hasCriteria = useMemo(() => {
    if (debouncedQuery.trim()) return true;
    if (tripFrom || tripTo) return true;
    return Object.values(filters).some(Boolean);
  }, [debouncedQuery, filters, tripFrom, tripTo]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["search", apiFilters],
    queryFn: ({ signal }) => postSearch(apiFilters, signal),
    enabled: hasCriteria,
    placeholderData: (prev) => prev,
    retry: 3,
    retryDelay: 800,
  });

  const uiTrips = useMemo(() => (data?.trips || []).map(toUiTrip), [data?.trips]);
  const vehicleSummaries = useMemo(() => buildVehicleSummaries(uiTrips), [uiTrips]);
  const matchedVehicles = vehicleSummaries;

  // If only 1 match, auto-select
  const activeVehicle = useMemo(() => {
    if (selectedVehicle) return selectedVehicle;
    if (searchType === "vehicleNumber" && matchedVehicles.length === 1) return matchedVehicles[0].vehicleNumber;
    return null;
  }, [matchedVehicles, searchType, selectedVehicle]);

  const filteredTrips = useMemo(() => {
    if (!hasCriteria) return [];
    return activeVehicle ? uiTrips.filter((t) => t.vehicleNumber === activeVehicle) : uiTrips;
  }, [activeVehicle, hasCriteria, uiTrips]);

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
      <form onSubmit={handleSearch} className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3">
        <SearchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <label htmlFor="search-type" className="sr-only">Search type</label>
        <select
          id="search-type"
          value={searchType}
          onChange={(e) => { setSearchType(e.target.value as SearchType); setSelectedVehicle(null); }}
          className="bg-transparent text-xs outline-none text-muted-foreground border-r pr-2 mr-2"
        >
          <option value="vehicleNumber">Vehicle</option>
          <option value="invoiceNumber">Invoice</option>
          <option value="chassisNumber">Chassis</option>
          <option value="bookNumber">Book</option>
          <option value="partyName">Party Name</option>
          <option value="loadingPoint">Loading Point</option>
          <option value="unloadingPoint">Unloading Point</option>
          <option value="tripKey">Trip Key</option>
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedVehicle(null); }}
          placeholder={
            searchType === "vehicleNumber"
              ? "Search by vehicle number (e.g. 28, 0028, JH05AC0028)"
              : searchType === "invoiceNumber"
              ? "Search by invoice number"
              : searchType === "chassisNumber"
              ? "Search by chassis number"
              : searchType === "bookNumber"
              ? "Search by book number"
              : searchType === "partyName"
              ? "Search by party name"
              : searchType === "loadingPoint"
              ? "Search by loading point"
              : searchType === "unloadingPoint"
              ? "Search by unloading point"
              : "Search by trip key"
          }
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoFocus
        />

        <div className="hidden md:flex items-center gap-2 pl-2 border-l">
          <label htmlFor="trip-from" className="text-xs text-muted-foreground">From</label>
          <input
            id="trip-from"
            type="date"
            value={tripFrom}
            onChange={(e) => { setTripFrom(e.target.value); setSelectedVehicle(null); }}
            className="bg-transparent text-xs outline-none text-muted-foreground"
          />
          <label htmlFor="trip-to" className="text-xs text-muted-foreground">To</label>
          <input
            id="trip-to"
            type="date"
            value={tripTo}
            onChange={(e) => { setTripTo(e.target.value); setSelectedVehicle(null); }}
            className="bg-transparent text-xs outline-none text-muted-foreground"
          />
        </div>
      </form>

      {/* Filters */}
      <FilterPanel filters={filters} onChange={setFilters} />

      {/* Results */}
      {hasCriteria && searchType === "vehicleNumber" && !activeVehicle && matchedVehicles.length > 1 && (
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

      {hasCriteria && !isLoading && matchedVehicles.length === 0 && filteredTrips.length === 0 && (
        <div className="text-center py-16">
          <SearchIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            No results found for {debouncedQuery.trim() ? `"${debouncedQuery}"` : "the selected filters"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Try a different search term or adjust filters</p>
        </div>
      )}

      {hasCriteria && isLoading && (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">Searching…</p>
        </div>
      )}

      {hasCriteria && isError && (
        <div className="text-center py-16">
          <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Search failed"}</p>
        </div>
      )}

      {hasCriteria && (activeVehicle || filteredTrips.length > 0) && !isLoading && !isError && (
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

      {!hasCriteria && (
        <div className="text-center py-16">
          <SearchIcon className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground">Start typing to search</p>
          <p className="text-xs text-muted-foreground mt-1">Search by vehicle number (e.g. 28, 0028, JH05AC0028), invoice, chassis, or book number</p>
        </div>
      )}
    </div>
  );
}
