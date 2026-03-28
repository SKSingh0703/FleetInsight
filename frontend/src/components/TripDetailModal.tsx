import { Trip } from "@/lib/mock-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Calendar, Weight, DollarSign, Fuel, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TripDetailModalProps {
  trip: Trip | null;
  open: boolean;
  onClose: () => void;
}

export function TripDetailModal({ trip, open, onClose }: TripDetailModalProps) {
  if (!trip) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {trip.invoiceNumber}
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
              <p className="text-xs text-muted-foreground">{trip.partyName} · {trip.partyType}</p>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            <DetailItem icon={Calendar} label="Loading Date" value={trip.loadingDate} />
            <DetailItem icon={Calendar} label="Unloading Date" value={trip.unloadingDate} />
            <DetailItem icon={Weight} label="Weight" value={`${trip.weight} MT`} />
            <DetailItem icon={DollarSign} label="Rate" value={`₹${trip.rate.toLocaleString("en-IN")}`} />
            <DetailItem icon={CircleDot} label="Book No." value={trip.bookNumber} />
            <DetailItem icon={CircleDot} label="Chassis No." value={trip.chassisNumber} />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
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
