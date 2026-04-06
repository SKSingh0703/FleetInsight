import { useMemo, useState } from "react";
import { Filter, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export interface Filters {
  tripType: "" | "OWN" | "MARKET";
  partyType: "" | "TPT" | "LOGISTICS" | "OTHER";
  partyName: string;
  deliveryNumber: string;
  tripNumber: string;
  loadingPoint: string;
  unloadingPoint: string;
  chassisNumber: string;
  bookNumber: string;
}

const emptyFilters: Filters = {
  tripType: "",
  partyType: "",
  partyName: "",
  deliveryNumber: "",
  tripNumber: "",
  loadingPoint: "",
  unloadingPoint: "",
  chassisNumber: "",
  bookNumber: "",
};

interface FilterPanelProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  partyNameOptions?: string[];
  deliveryNumberOptions?: string[];
  tripNumberOptions?: string[];
  loadingPointOptions?: string[];
  unloadingPointOptions?: string[];
  chassisNumberOptions?: string[];
  bookNumberOptions?: string[];
}

export function FilterPanel({
  filters,
  onChange,
  partyNameOptions,
  deliveryNumberOptions,
  tripNumberOptions,
  loadingPointOptions,
  unloadingPointOptions,
  chassisNumberOptions,
  bookNumberOptions,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [tripTypeOpen, setTripTypeOpen] = useState(false);
  const [partyTypeOpen, setPartyTypeOpen] = useState(false);
  const [partyNameOpen, setPartyNameOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [tripNumberOpen, setTripNumberOpen] = useState(false);
  const [loadingPointOpen, setLoadingPointOpen] = useState(false);
  const [unloadingPointOpen, setUnloadingPointOpen] = useState(false);
  const [chassisOpen, setChassisOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const activeCount = Object.values(filters).filter(Boolean).length;

  const tripTypeItems = useMemo(() => ["", "OWN", "MARKET"], []);
  const partyTypeItems = useMemo(() => ["", "TPT", "LOGISTICS", "OTHER"], []);

  const partyNameItems = useMemo(() => {
    const src = Array.isArray(partyNameOptions) ? partyNameOptions : [];
    const out = src
      .map((s) => (typeof s === "string" ? s.trim() : String(s || "").trim()))
      .filter(Boolean);
    return ["", ...out];
  }, [partyNameOptions]);

  const deliveryItems = useMemo(() => {
    const src = Array.isArray(deliveryNumberOptions) ? deliveryNumberOptions : [];
    const out = src
      .map((s) => (typeof s === "string" ? s.trim() : String(s || "").trim()))
      .filter(Boolean);
    return ["", ...out];
  }, [deliveryNumberOptions]);

  const tripNumberItems = useMemo(() => {
    const src = Array.isArray(tripNumberOptions) ? tripNumberOptions : [];
    const out = src
      .map((s) => (typeof s === "string" ? s.trim() : String(s || "").trim()))
      .filter(Boolean);
    return ["", ...out];
  }, [tripNumberOptions]);

  const loadingPointItems = useMemo(() => {
    const src = Array.isArray(loadingPointOptions) ? loadingPointOptions : [];
    const out = src
      .map((s) => (typeof s === "string" ? s.trim() : String(s || "").trim()))
      .filter(Boolean);
    return ["", ...out];
  }, [loadingPointOptions]);

  const unloadingPointItems = useMemo(() => {
    const src = Array.isArray(unloadingPointOptions) ? unloadingPointOptions : [];
    const out = src
      .map((s) => (typeof s === "string" ? s.trim() : String(s || "").trim()))
      .filter(Boolean);
    return ["", ...out];
  }, [unloadingPointOptions]);

  const chassisItems = useMemo(() => {
    const src = Array.isArray(chassisNumberOptions) ? chassisNumberOptions : [];
    const out = src
      .map((s) => (typeof s === "string" ? s.trim() : String(s || "").trim()))
      .filter(Boolean);
    return ["", ...out];
  }, [chassisNumberOptions]);

  const bookItems = useMemo(() => {
    const src = Array.isArray(bookNumberOptions) ? bookNumberOptions : [];
    const out = src
      .map((s) => (typeof s === "string" ? s.trim() : String(s || "").trim()))
      .filter(Boolean);
    return ["", ...out];
  }, [bookNumberOptions]);

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
            Party Type: {filters.partyType}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("partyType", "")} />
          </span>
        )}
        {filters.partyName && (
          <span className="filter-chip">
            Party Name: {filters.partyName}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("partyName", "")} />
          </span>
        )}
        {filters.deliveryNumber && (
          <span className="filter-chip">
            Delivery No.: {filters.deliveryNumber}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("deliveryNumber", "")} />
          </span>
        )}
        {filters.tripNumber && (
          <span className="filter-chip">
            Trip No.: {filters.tripNumber}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("tripNumber", "")} />
          </span>
        )}
        {filters.loadingPoint && (
          <span className="filter-chip">
            Loading Point: {filters.loadingPoint}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("loadingPoint", "")} />
          </span>
        )}
        {filters.unloadingPoint && (
          <span className="filter-chip">
            Unloading Point: {filters.unloadingPoint}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("unloadingPoint", "")} />
          </span>
        )}
        {filters.chassisNumber && (
          <span className="filter-chip">
            Chassis: {filters.chassisNumber}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("chassisNumber", "")} />
          </span>
        )}
        {filters.bookNumber && (
          <span className="filter-chip">
            Book: {filters.bookNumber}
            <X className="h-3 w-3 cursor-pointer" onClick={() => update("bookNumber", "")} />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4 rounded-xl border bg-card">
              <div className="space-y-1.5">
                <label htmlFor="filter-tripType" className="text-xs font-medium text-muted-foreground">Trip Type</label>
                <Popover open={tripTypeOpen} onOpenChange={setTripTypeOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="filter-tripType"
                      type="button"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 flex items-center justify-between"
                    >
                      <span className={filters.tripType ? "" : "text-muted-foreground"}>
                        {filters.tripType || "All"}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${tripTypeOpen ? "rotate-180" : ""}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search trip type" />
                      <CommandList>
                        <CommandEmpty>No options found.</CommandEmpty>
                        <CommandGroup>
                          {tripTypeItems.map((opt) => (
                            <CommandItem
                              key={opt || "__all"}
                              value={opt || "All"}
                              onSelect={() => {
                                update("tripType", opt as Filters["tripType"]);
                                setTripTypeOpen(false);
                              }}
                            >
                              {opt ? opt : "All"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-deliveryNo" className="text-xs font-medium text-muted-foreground">Delivery No.</label>
                <Popover open={deliveryOpen} onOpenChange={setDeliveryOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="filter-deliveryNo"
                      type="button"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 flex items-center justify-between"
                    >
                      <span className={filters.deliveryNumber ? "" : "text-muted-foreground"}>
                        {filters.deliveryNumber || "Search delivery"}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${deliveryOpen ? "rotate-180" : ""}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search delivery" />
                      <CommandList>
                        <CommandEmpty>No delivery found.</CommandEmpty>
                        <CommandGroup>
                          {deliveryItems.map((opt) => (
                            <CommandItem
                              key={opt || "__all"}
                              value={opt || "All"}
                              onSelect={() => {
                                update("deliveryNumber", opt);
                                setDeliveryOpen(false);
                              }}
                            >
                              {opt ? opt : "All"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-tripNo" className="text-xs font-medium text-muted-foreground">Trip No.</label>
                <Popover open={tripNumberOpen} onOpenChange={setTripNumberOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="filter-tripNo"
                      type="button"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 flex items-center justify-between"
                    >
                      <span className={filters.tripNumber ? "" : "text-muted-foreground"}>
                        {filters.tripNumber || "Search trip no."}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${tripNumberOpen ? "rotate-180" : ""}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search trip no." />
                      <CommandList>
                        <CommandEmpty>No trip found.</CommandEmpty>
                        <CommandGroup>
                          {tripNumberItems.map((opt) => (
                            <CommandItem
                              key={opt || "__all"}
                              value={opt || "All"}
                              onSelect={() => {
                                update("tripNumber", opt);
                                setTripNumberOpen(false);
                              }}
                            >
                              {opt ? opt : "All"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-partyType" className="text-xs font-medium text-muted-foreground">Party Type</label>
                <Popover open={partyTypeOpen} onOpenChange={setPartyTypeOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="filter-partyType"
                      type="button"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 flex items-center justify-between"
                    >
                      <span className={filters.partyType ? "" : "text-muted-foreground"}>
                        {filters.partyType || "All"}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${partyTypeOpen ? "rotate-180" : ""}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search party type" />
                      <CommandList>
                        <CommandEmpty>No options found.</CommandEmpty>
                        <CommandGroup>
                          {partyTypeItems.map((opt) => (
                            <CommandItem
                              key={opt || "__all"}
                              value={opt || "All"}
                              onSelect={() => {
                                update("partyType", opt as Filters["partyType"]);
                                setPartyTypeOpen(false);
                              }}
                            >
                              {opt ? opt : "All"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-partyName" className="text-xs font-medium text-muted-foreground">Party Name</label>
                <Popover open={partyNameOpen} onOpenChange={setPartyNameOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="filter-partyName"
                      type="button"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 flex items-center justify-between"
                    >
                      <span className={filters.partyName ? "" : "text-muted-foreground"}>
                        {filters.partyName || "Search party name"}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${partyNameOpen ? "rotate-180" : ""}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search party name" />
                      <CommandList>
                        <CommandEmpty>No party found.</CommandEmpty>
                        <CommandGroup>
                          {partyNameItems.map((opt) => (
                            <CommandItem
                              key={opt || "__all"}
                              value={opt || "All"}
                              onSelect={() => {
                                update("partyName", opt);
                                setPartyNameOpen(false);
                              }}
                            >
                              {opt ? opt : "All"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-loadingPoint" className="text-xs font-medium text-muted-foreground">Loading Point</label>
                <Popover open={loadingPointOpen} onOpenChange={setLoadingPointOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="filter-loadingPoint"
                      type="button"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 flex items-center justify-between"
                    >
                      <span className={filters.loadingPoint ? "" : "text-muted-foreground"}>
                        {filters.loadingPoint || "Search loading point"}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${loadingPointOpen ? "rotate-180" : ""}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search loading point" />
                      <CommandList>
                        <CommandEmpty>No location found.</CommandEmpty>
                        <CommandGroup>
                          {loadingPointItems.map((opt) => (
                            <CommandItem
                              key={opt || "__all"}
                              value={opt || "All"}
                              onSelect={() => {
                                update("loadingPoint", opt);
                                setLoadingPointOpen(false);
                              }}
                            >
                              {opt ? opt : "All"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-unloadingPoint" className="text-xs font-medium text-muted-foreground">Unloading Point</label>
                <Popover open={unloadingPointOpen} onOpenChange={setUnloadingPointOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="filter-unloadingPoint"
                      type="button"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 flex items-center justify-between"
                    >
                      <span className={filters.unloadingPoint ? "" : "text-muted-foreground"}>
                        {filters.unloadingPoint || "Search unloading point"}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${unloadingPointOpen ? "rotate-180" : ""}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search unloading point" />
                      <CommandList>
                        <CommandEmpty>No location found.</CommandEmpty>
                        <CommandGroup>
                          {unloadingPointItems.map((opt) => (
                            <CommandItem
                              key={opt || "__all"}
                              value={opt || "All"}
                              onSelect={() => {
                                update("unloadingPoint", opt);
                                setUnloadingPointOpen(false);
                              }}
                            >
                              {opt ? opt : "All"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-chassis" className="text-xs font-medium text-muted-foreground">Chassis No.</label>
                <Popover open={chassisOpen} onOpenChange={setChassisOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="filter-chassis"
                      type="button"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 flex items-center justify-between"
                    >
                      <span className={filters.chassisNumber ? "" : "text-muted-foreground"}>
                        {filters.chassisNumber || "Search chassis"}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${chassisOpen ? "rotate-180" : ""}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search chassis" />
                      <CommandList>
                        <CommandEmpty>No chassis found.</CommandEmpty>
                        <CommandGroup>
                          {chassisItems.map((opt) => (
                            <CommandItem
                              key={opt || "__all"}
                              value={opt || "All"}
                              onSelect={() => {
                                update("chassisNumber", opt);
                                setChassisOpen(false);
                              }}
                            >
                              {opt ? opt : "All"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="filter-book" className="text-xs font-medium text-muted-foreground">Book No.</label>
                <Popover open={bookOpen} onOpenChange={setBookOpen}>
                  <PopoverTrigger asChild>
                    <button
                      id="filter-book"
                      type="button"
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 flex items-center justify-between"
                    >
                      <span className={filters.bookNumber ? "" : "text-muted-foreground"}>
                        {filters.bookNumber || "Search book"}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${bookOpen ? "rotate-180" : ""}`} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search book" />
                      <CommandList>
                        <CommandEmpty>No book found.</CommandEmpty>
                        <CommandGroup>
                          {bookItems.map((opt) => (
                            <CommandItem
                              key={opt || "__all"}
                              value={opt || "All"}
                              onSelect={() => {
                                update("bookNumber", opt);
                                setBookOpen(false);
                              }}
                            >
                              {opt ? opt : "All"}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
