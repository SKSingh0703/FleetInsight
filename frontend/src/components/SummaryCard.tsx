import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "income" | "expense" | "profit";
}

const variantStyles = {
  default: "bg-card",
  income: "bg-primary/5 border-primary/20",
  expense: "bg-destructive/5 border-destructive/20",
  profit: "bg-success/5 border-success/20",
};

const iconStyles = {
  default: "bg-muted text-muted-foreground",
  income: "bg-primary/10 text-primary",
  expense: "bg-destructive/10 text-destructive",
  profit: "bg-success/10 text-success",
};

export function SummaryCard({ title, value, subtitle, icon: Icon, variant = "default" }: SummaryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`stat-card ${variantStyles[variant]}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-display font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconStyles[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
