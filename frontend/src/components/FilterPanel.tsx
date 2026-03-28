import { useState } from "react";
import { Filter, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

export interface Filters {
  tripType: "" | "OWN" | "MARKET";
  partyType: "" | "TPT" | "LOGISTICS" | "OTHER";
  loadingFrom: string;
  loadingTo: string;
  unloadingFrom: string;
  unloadingTo: string;
}

const emptyFilters: Filters = {
  tripType: "",
  partyType: "",
  loadingFrom: "",
  loadingTo: "",
  unloadingFrom: "",
  unloadingTo: "",
};

interface FilterPanelProps {
  filters: Filters;
  onChange: (f: Filters) => void;
}

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(filters).filter(Boolean).length;

  const update = <K extends keyof Filters>(key: K, val: Filters[K]) => {
    onChange({ ...filters, [key]: val });
  };

  const reset = () => onChange(emptyFilters);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(!open)}
          className="gap-1.5"
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
              {activeCount}
            </Badge>
          )}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>

        {/* Active filter chips */}
        {filters.tripType && (
          <span className="filter-chip">
            {filters.tripType}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("tripType", "")} />
          </span>
        )}
        {filters.partyType && (
          <span className="filter-chip">
            {filters.partyType}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("partyType", "")} />
          </span>
        )}
        {filters.loadingFrom && (
          <span className="filter-chip">
            Loading from: {filters.loadingFrom}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("loadingFrom", "")} />
          </span>
        )}
        {filters.loadingTo && (
          <span className="filter-chip">
            Loading to: {filters.loadingTo}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("loadingTo", "")} />
          </span>
        )}
        {filters.unloadingFrom && (
          <span className="filter-chip">
            Unloading from: {filters.unloadingFrom}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("unloadingFrom", "")} />
          </span>
        )}
        {filters.unloadingTo && (
          <span className="filter-chip">
            Unloading to: {filters.unloadingTo}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("unloadingTo", "")} />
          </span>
        )}

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs text-muted-foreground">
            Clear all
          </Button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl border bg-card">
              <div className="space-y-1.5">
                <label htmlFor="filter-tripType" className="text-xs font-medium text-muted-foreground">Trip Type</label>
                <select
                  id="filter-tripType"
                  value={filters.tripType}
                  onChange={(e) => update("tripType", e.target.value as Filters["tripType"])}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">All</option>
                  <option value="OWN">OWN</option>
                  <option value="MARKET">MARKET</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-partyType" className="text-xs font-medium text-muted-foreground">Party Type</label>
                <select
                  id="filter-partyType"
                  value={filters.partyType}
                  onChange={(e) => update("partyType", e.target.value as Filters["partyType"])}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">All</option>
                  <option value="TPT">TPT</option>
                  <option value="LOGISTICS">LOGISTICS</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-loadingFrom" className="text-xs font-medium text-muted-foreground">Loading Date From</label>
                <input
                  id="filter-loadingFrom"
                  type="date"
                  value={filters.loadingFrom}
                  onChange={(e) => update("loadingFrom", e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-loadingTo" className="text-xs font-medium text-muted-foreground">Loading Date To</label>
                <input
                  id="filter-loadingTo"
                  type="date"
                  value={filters.loadingTo}
                  onChange={(e) => update("loadingTo", e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-unloadingFrom" className="text-xs font-medium text-muted-foreground">Unloading Date From</label>
                <input
                  id="filter-unloadingFrom"
                  type="date"
                  value={filters.unloadingFrom}
                  onChange={(e) => update("unloadingFrom", e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-unloadingTo" className="text-xs font-medium text-muted-foreground">Unloading Date To</label>
                <input
                  id="filter-unloadingTo"
                  type="date"
                  value={filters.unloadingTo}
                  onChange={(e) => update("unloadingTo", e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
