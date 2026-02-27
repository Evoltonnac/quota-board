import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";
import {
    TrendingUp,
    TrendingDown,
    Minus,
    AlertCircle,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { cn } from "../lib/utils";

// Format value based on format string (e.g., "${value:.2f}" -> "$12.34")
function formatValue(
    value: number | string | undefined,
    format?: string,
): string {
    if (value === undefined || value === null) return "N/A";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return String(value);

    if (format) {
        // Handle template format like "${value:.2f}"
        if (format.includes("{")) {
            return format
                .replace(/\{value\}/g, numValue.toFixed(2))
                .replace(/\$/g, "$");
        }
        // Handle simple format like "$%.2f" or "%.2f"
        return format
            .replace(/%/g, "")
            .replace("$", "$")
            .replace("f", numValue.toFixed(2));
    }

    // Default formatting for large numbers
    if (numValue >= 1000000) {
        return (numValue / 1000000).toFixed(2) + "M";
    }
    if (numValue >= 1000) {
        return (numValue / 1000).toFixed(2) + "K";
    }
    return numValue.toFixed(2);
}

// Calculate percentage
function calcPercentage(used: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.min(100, Math.max(0, (used / total) * 100));
}

// Get color based on usage percentage
function getUsageColor(percentage: number): string {
    if (percentage >= 90) return "bg-destructive"; // red
    if (percentage >= 75) return "bg-amber-500"; // warning
    return "bg-emerald-500"; // green
}

// Get icon based on status
function getStatusIcon(status: "ok" | "warning" | "critical" | "error") {
    switch (status) {
        case "ok":
            return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
        case "warning":
            return <AlertCircle className="h-4 w-4 text-amber-500" />;
        case "critical":
            return <AlertCircle className="h-4 w-4 text-destructive" />;
        case "error":
            return <XCircle className="h-4 w-4 text-destructive" />;
    }
}

export interface QuotaCardProps {
    title: string;
    limit?: number | string;
    usage?: number | string;
    remaining?: number | string;
    limitField?: string;
    usageField?: string;
    remainingField?: string;
    data?: Record<string, any>;
    format?: string;
    showProgress?: boolean;
    showTrend?: boolean;
    trendValue?: number | string;
    status?: "ok" | "warning" | "critical" | "error";
    className?: string;
}

export function QuotaCard({
    title,
    limit,
    usage,
    remaining,
    data = {},
    format,
    showProgress = true,
    showTrend = false,
    trendValue,
    status = "ok",
    className,
}: QuotaCardProps) {
    // Get values from data if not provided directly
    const limitValue = limit ?? data.limit ?? data.limit_total;
    const usageValue = usage ?? data.usage ?? data.used;
    const remainingValue = remaining ?? data.remaining ?? data.limit_remaining;

    const limitNum =
        typeof limitValue === "string" ? parseFloat(limitValue) : limitValue;
    const usageNum =
        typeof usageValue === "string" ? parseFloat(usageValue) : usageValue;

    const percentage = calcPercentage(usageNum as number, limitNum as number);
    const usageColor = getUsageColor(percentage);

    return (
        <Card
            className={cn(
                "bg-card border-border h-full flex flex-col overflow-hidden",
                className,
            )}
        >
            {/* Embedded border header */}
            <div
                className="qb-card-header flex-shrink-0 flex items-center justify-between px-3 border-b border-border/40 bg-card"
                style={{ height: "var(--qb-card-header-height)" }}
            >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-xs font-medium text-muted-foreground truncate">
                        {title}
                    </span>
                    <span className="shrink-0">{getStatusIcon(status)}</span>
                </div>
            </div>
            <CardContent className="flex-1 overflow-auto min-h-0 flex flex-col justify-center px-3 py-2">
                {/* Main value display */}
                <div className="flex items-baseline gap-2 mb-3 shrink-0">
                    <span className="text-2xl font-bold">
                        {formatValue(usageValue, format)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                        / {formatValue(limitValue, format)}
                    </span>
                </div>

                {/* Progress bar */}
                {showProgress && (
                    <div className="mb-3 shrink-0">
                        <Progress
                            value={percentage}
                            className="h-2"
                            indicatorClassName={usageColor}
                        />
                        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                            <span>{percentage.toFixed(1)}% used</span>
                            <span>
                                {formatValue(remainingValue, format)} remaining
                            </span>
                        </div>
                    </div>
                )}

                {/* Trend indicator */}
                {showTrend && trendValue !== undefined && (
                    <div className="flex items-center gap-1 text-xs shrink-0">
                        {(trendValue as number) > 0 ? (
                            <TrendingUp className="h-3 w-3 text-amber-500" />
                        ) : (trendValue as number) < 0 ? (
                            <TrendingDown className="h-3 w-3 text-emerald-500" />
                        ) : (
                            <Minus className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span
                            className={cn(
                                Number(trendValue) > 0
                                    ? "text-amber-500"
                                    : Number(trendValue) < 0
                                      ? "text-emerald-500"
                                      : "text-muted-foreground",
                            )}
                        >
                            {Math.abs(trendValue as number).toFixed(2)}%
                        </span>
                        <span className="text-muted-foreground">
                            vs last period
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
