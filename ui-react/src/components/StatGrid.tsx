import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { ComponentType } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Percent,
  Activity,
  Clock,
  Zap,
  HardDrive,
  Wifi,
  Cpu,
  Gauge,
  Wallet,
  CreditCard,
  Timer,
  BarChart3,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { StatGridItem } from "../types/config";

// Icon mapping for common metric types
const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  dollar: DollarSign,
  percent: Percent,
  activity: Activity,
  clock: Clock,
  zap: Zap,
  storage: HardDrive,
  wifi: Wifi,
  cpu: Cpu,
  gauge: Gauge,
  wallet: Wallet,
  credit: CreditCard,
  timer: Timer,
  chart: BarChart3,
  trending: TrendingUp,
  trend_up: TrendingUp,
  trend_down: TrendingDown,
  minus: Minus,
};

// Format value based on format string
function formatValue(value: number | string | undefined, format?: string): string {
  if (value === undefined || value === null) return "N/A";
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue)) return String(value);

  if (format) {
    if (format.includes("{value}")) {
      return format.replace(/\{value\}/g, numValue.toFixed(2));
    }
    return format.replace(/%/g, "").replace("$", "$").replace("f", numValue.toFixed(2));
  }

  if (numValue >= 1000000) {
    return (numValue / 1000000).toFixed(2) + "M";
  }
  if (numValue >= 1000) {
    return (numValue / 1000).toFixed(2) + "K";
  }
  return numValue.toFixed(2);
}

// Get icon component from string
function getIcon(iconName?: string) {
  if (!iconName) return null;
  const IconComponent = iconMap[iconName.toLowerCase()];
  return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
}

// Get color class from string
function getColorClass(color?: string): string {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-500",
    green: "text-emerald-500",
    amber: "text-amber-500",
    yellow: "text-amber-500",
    red: "text-destructive",
    destructive: "text-destructive",
    blue: "text-blue-500",
    purple: "text-purple-500",
    cyan: "text-cyan-500",
    gray: "text-muted-foreground",
    muted: "text-muted-foreground",
  };
  return colorMap[color?.toLowerCase() || ""] || "text-foreground";
}

export interface StatGridProps {
  title?: string;
  items: StatGridItem[];
  data: Record<string, any>;
  columns?: number;
  className?: string;
}

export function StatGrid({
  title,
  items,
  data,
  columns = 2,
  className,
}: StatGridProps) {
  return (
    <Card className={cn("bg-card border-border", className)}>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div
          className={cn(
            "grid gap-3",
            columns === 2 && "grid-cols-2",
            columns === 3 && "grid-cols-3",
            columns === 4 && "grid-cols-2 sm:grid-cols-4",
            columns === 6 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
          )}
        >
          {items.map((item, index) => {
            const value = data[item.field];
            const formattedValue = formatValue(value, item.format);
            const colorClass = getColorClass(item.color);
            const Icon = getIcon(item.icon);

            return (
              <div
                key={index}
                className="flex flex-col p-2 rounded-md bg-secondary/30"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {Icon && (
                    <span className={cn("opacity-70", colorClass)}>{Icon}</span>
                  )}
                  <span className="text-xs text-muted-foreground truncate">
                    {item.label}
                  </span>
                </div>
                <span className={cn("text-lg font-semibold", colorClass)}>
                  {formattedValue}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
