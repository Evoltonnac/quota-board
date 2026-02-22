import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { AlertCircle, AlertTriangle } from "lucide-react";
import type {
    ViewComponent,
    SourceSummary,
    DataResponse,
} from "../types/config";
import { WidgetRenderer } from "./widgets/WidgetRenderer";

interface BaseSourceCardProps {
    component: ViewComponent;
    sourceSummary?: SourceSummary;
    sourceData?: DataResponse | null;
    onInteract?: (source: SourceSummary) => void;
}

export function BaseSourceCard({
    component,
    sourceSummary,
    sourceData,
    onInteract,
}: BaseSourceCardProps) {
    const ui = component.ui || {
        title: component.label || "Untitled",
        icon: undefined,
        status_field: undefined,
    };

    // Determine overall status
    let status = sourceSummary?.status || "disabled";
    if (
        sourceSummary?.has_data &&
        status === "active" &&
        !sourceData?.error &&
        !sourceSummary?.error
    ) {
        status = "active";
    } else if (sourceData?.error || sourceSummary?.error) {
        status = "error";
    }

    // Status color mapping
    const statusColorMap: Record<string, string> = {
        active: "bg-green-500",
        suspended: "bg-yellow-500",
        error: "bg-red-500",
        disabled: "bg-gray-500",
    };

    return (
        <Card className="bg-card border-border flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                    {/* Placeholder for icon if provided */}
                    {ui.icon && <span className="text-xl">{ui.icon}</span>}
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        {ui.title}
                    </CardTitle>
                </div>
                {/* Status Dot */}
                <div
                    title={`Status: ${status}`}
                    className={`w-2.5 h-2.5 rounded-full ${statusColorMap[status] || "bg-gray-500"} shrink-0 ml-2`}
                />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col pt-2 pb-4">
                {/* System Shield for unhealthy states */}
                {status === "error" && (
                    <div className="flex flex-col items-center justify-center p-4 bg-destructive/10 rounded-md border border-destructive/20 mt-2 flex-1 min-h-[120px]">
                        <AlertCircle className="w-8 h-8 text-destructive mb-2 shrink-0" />
                        <span className="text-sm font-medium text-destructive">
                            Data Error
                        </span>
                        <span className="text-xs text-muted-foreground mt-1 text-center line-clamp-2">
                            {sourceData?.error ||
                                sourceSummary?.error ||
                                "Unknown error"}
                        </span>
                    </div>
                )}

                {status === "suspended" && (
                    <div className="flex flex-col items-center justify-center p-4 bg-yellow-500/10 rounded-md border border-yellow-500/20 mt-2 flex-1 min-h-[120px]">
                        <AlertTriangle className="w-8 h-8 text-yellow-500 mb-2 shrink-0" />
                        <span className="text-sm font-medium text-yellow-500">
                            Action Required
                        </span>
                        <span className="text-xs text-muted-foreground mt-1 text-center mb-3">
                            {sourceSummary?.message ||
                                "Missing credentials or action needed."}
                        </span>
                        {onInteract && sourceSummary && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-yellow-500 text-yellow-500 hover:bg-yellow-500/20"
                                onClick={() => onInteract(sourceSummary)}
                            >
                                Resolve Issue
                            </Button>
                        )}
                    </div>
                )}

                {/* Healthy state - Render widgets */}
                {status === "active" && (!sourceData || !sourceData.data) && (
                    <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground py-6 min-h-[120px]">
                        No data available.
                    </div>
                )}

                {status === "active" &&
                    sourceData?.data &&
                    component.widgets &&
                    component.widgets.length > 0 && (
                        <div className="flex flex-col gap-5 h-full pt-1">
                            {component.widgets.map((widget, idx) => (
                                <WidgetRenderer
                                    key={idx}
                                    widget={widget}
                                    data={sourceData.data!}
                                />
                            ))}
                        </div>
                    )}
            </CardContent>
        </Card>
    );
}
