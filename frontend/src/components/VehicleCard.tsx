import { Truck, TrendingUp, TrendingDown } from "lucide-react";
import { Vehicle } from "@/lib/mock-data";
import { motion } from "framer-motion";

interface VehicleCardProps {
  vehicle: Vehicle;
  onClick: () => void;
  index?: number;
}

export function VehicleCard({ vehicle, onClick, index = 0 }: VehicleCardProps) {
  const isProfit = vehicle.profit >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={onClick}
      className="vehicle-card"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Truck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-display font-semibold">{vehicle.vehicleNumber}</p>
          <p className="text-xs text-muted-foreground">{vehicle.totalTrips} trips</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t">
        <div>
          <p className="text-xs text-muted-foreground">Profit</p>
          <p className={`text-sm font-semibold ${isProfit ? "text-success" : "text-destructive"}`}>
            ₹{vehicle.profit.toLocaleString("en-IN")}
          </p>
        </div>
        {isProfit ? (
          <TrendingUp className="h-4 w-4 text-success" />
        ) : (
          <TrendingDown className="h-4 w-4 text-destructive" />
        )}
      </div>
    </motion.div>
  );
}
