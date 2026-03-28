import { SummaryCard } from "@/components/SummaryCard";
import { TripTable } from "@/components/TripTable";
import { VehicleCard } from "@/components/VehicleCard";
import { mockTrips, mockVehicles } from "@/lib/mock-data";
import { Truck, IndianRupee, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Dashboard() {
  const navigate = useNavigate();

  const totalTrips = mockTrips.length;
  const totalIncome = mockTrips.reduce((s, t) => s + t.income, 0);
  const totalExpenses = mockTrips.reduce((s, t) => s + t.totalExpenses, 0);
  const totalProfit = totalIncome - totalExpenses;

  const sorted = [...mockVehicles].sort((a, b) => b.profit - a.profit);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const recentTrips = [...mockTrips].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Fleet performance overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Trips" value={totalTrips.toString()} icon={Truck} />
        <SummaryCard title="Total Income" value={`₹${totalIncome.toLocaleString("en-IN")}`} icon={IndianRupee} variant="income" />
        <SummaryCard title="Total Expenses" value={`₹${totalExpenses.toLocaleString("en-IN")}`} icon={BarChart3} variant="expense" />
        <SummaryCard title="Total Profit" value={`₹${totalProfit.toLocaleString("en-IN")}`} icon={TrendingUp} variant="profit" />
      </div>

      {/* Best / Worst vehicles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="stat-card border-success/20">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-success" />
            <h3 className="text-sm font-semibold text-muted-foreground">Best Performing Vehicle</h3>
          </div>
          <p className="text-xl font-display font-bold">{best.vehicleNumber}</p>
          <p className="text-sm text-success font-medium">₹{best.profit.toLocaleString("en-IN")} profit · {best.totalTrips} trips</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="stat-card border-destructive/20">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-muted-foreground">Worst Performing Vehicle</h3>
          </div>
          <p className="text-xl font-display font-bold">{worst.vehicleNumber}</p>
          <p className="text-sm text-destructive font-medium">₹{worst.profit.toLocaleString("en-IN")} profit · {worst.totalTrips} trips</p>
        </motion.div>
      </div>

      {/* Recent trips */}
      <div>
        <h2 className="text-lg font-display font-semibold mb-3">Recent Trips</h2>
        <TripTable trips={recentTrips} />
      </div>
    </div>
  );
}
