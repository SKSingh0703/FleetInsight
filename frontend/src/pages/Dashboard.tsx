import { SummaryCard } from "@/components/SummaryCard";
import { TripTable } from "@/components/TripTable";
import { Truck, IndianRupee, TrendingUp, BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, getDashboard, toUiTrip } from "@/services/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getUTCMonth() + 1);
  const [year, setYear] = useState<number>(now.getUTCFullYear());

  const maxRows = 150;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", month, year],
    queryFn: ({ signal }) => getDashboard({ month, year, limit: maxRows, signal }),
    placeholderData: (prev) => prev,
    retry: 3,
    retryDelay: 800,
  });

  const uiTrips = useMemo(() => (data?.trips || []).map(toUiTrip), [data?.trips]);
  const recentTrips = useMemo(() => uiTrips.slice(0, maxRows), [uiTrips, maxRows]);

  const totalTrips = data?.summary?.totalTrips ?? 0;
  const totalIncome = data?.summary?.totalRevenue ?? 0;
  const totalExpenses = data?.summary?.totalExpenses ?? 0;
  const totalProfit = data?.summary?.totalProfit ?? 0;

  const isInitialLoading = (isLoading || isFetching) && !data;

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

      {isInitialLoading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card bg-card">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16 mt-2" />
            </div>
            <div className="stat-card bg-primary/5 border-primary/20">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20 mt-2" />
            </div>
            <div className="stat-card bg-destructive/5 border-destructive/20">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20 mt-2" />
            </div>
            <div className="stat-card bg-success/5 border-success/20">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20 mt-2" />
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </>
      )}

      {isError && !data && (
        <Alert variant="destructive">
          <AlertTitle>Unable to load dashboard</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <div>
                {error instanceof ApiError && error.isNetworkError
                  ? "Server unreachable. Check your connection or backend server."
                  : error instanceof Error
                    ? error.message
                    : "Failed to load"}
              </div>
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {isError && data && (
        <Alert variant="destructive">
          <AlertTitle>Connection issue</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <div>
                Showing last loaded data. {error instanceof ApiError && error.isNetworkError
                  ? "Server unreachable."
                  : "Refresh to try again."}
              </div>
              <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

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
      {!isInitialLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Trips" value={totalTrips.toString()} icon={Truck} />
          <SummaryCard title="Total Income" value={`₹${totalIncome.toLocaleString("en-IN")}`} icon={IndianRupee} variant="income" />
          <SummaryCard title="Total Expenses" value={`₹${totalExpenses.toLocaleString("en-IN")}`} icon={BarChart3} variant="expense" />
          <SummaryCard title="Total Profit" value={`₹${totalProfit.toLocaleString("en-IN")}`} icon={TrendingUp} variant="profit" />
        </div>
      )}

      {/* Recent trips */}
      {!isInitialLoading && (
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-lg font-display font-semibold">Trips</h2>
          {(isLoading || isFetching) && <span className="text-xs text-muted-foreground">Loading…</span>}
          {isError && (
            <span className="text-xs text-destructive">
              {error instanceof Error ? error.message : "Failed to load"}
            </span>
          )}
        </div>
        <TripTable trips={recentTrips} />
      </div>
      )}
    </div>
  );
}
