import { SummaryCard } from "@/components/SummaryCard";
import { TripTable } from "@/components/TripTable";
import { Truck, IndianRupee, TrendingUp, BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { postSearch, toUiTrip } from "@/services/api";

export default function Dashboard() {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getUTCMonth() + 1);
  const [year, setYear] = useState<number>(now.getUTCFullYear());

  const maxRows = 1500;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard", month, year],
    queryFn: () => postSearch({ month, year, limit: maxRows }),
  });

  const uiTrips = useMemo(() => (data?.trips || []).map(toUiTrip), [data?.trips]);
  const recentTrips = useMemo(() => uiTrips.slice(0, maxRows), [uiTrips, maxRows]);

  const totalTrips = data?.summary?.totalTrips ?? 0;
  const totalIncome = data?.summary?.totalRevenue ?? 0;
  const totalExpenses = data?.summary?.totalExpenses ?? 0;
  const totalProfit = data?.summary?.totalProfit ?? 0;

  const years = useMemo(() => {
    const y = new Date().getUTCFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Fleet performance overview</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="space-y-1">
          <label htmlFor="dashboard-month" className="text-xs font-medium text-muted-foreground">Month</label>
          <select
            id="dashboard-month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(Date.UTC(2000, i, 1)).toLocaleString("en-IN", { month: "long" })}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="dashboard-year" className="text-xs font-medium text-muted-foreground">Year</label>
          <select
            id="dashboard-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Trips" value={totalTrips.toString()} icon={Truck} />
        <SummaryCard title="Total Income" value={`₹${totalIncome.toLocaleString("en-IN")}`} icon={IndianRupee} variant="income" />
        <SummaryCard title="Total Expenses" value={`₹${totalExpenses.toLocaleString("en-IN")}`} icon={BarChart3} variant="expense" />
        <SummaryCard title="Total Profit" value={`₹${totalProfit.toLocaleString("en-IN")}`} icon={TrendingUp} variant="profit" />
      </div>

      {/* Recent trips */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-lg font-display font-semibold">Trips</h2>
          {isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
          {isError && (
            <span className="text-xs text-destructive">
              {error instanceof Error ? error.message : "Failed to load"}
            </span>
          )}
        </div>
        <TripTable trips={recentTrips} />
      </div>
    </div>
  );
}
