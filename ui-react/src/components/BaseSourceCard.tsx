import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
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
}: BaseSourceCardProps) {
    const ui = component.ui || {
        title: component.label || "Untitled",
        icon: undefined,
        status_field: undefined,
    };

    // Determine dot status (for the indicator only)
    const rawStatus = sourceSummary?.status || "disabled";
    let dotStatus: "active" | "refreshing" | "error" | "suspended" | "disabled";
    if ((rawStatus as string) === "refreshing") {
        dotStatus = "refreshing";
    } else if (sourceData?.error || sourceSummary?.error) {
        dotStatus = "error";
    } else if (rawStatus === "suspended") {
        dotStatus = "suspended";
    } else if (sourceSummary?.has_data && rawStatus === "active") {
        dotStatus = "active";
    } else {
        dotStatus = rawStatus as any;
    }

    // Status dot color mapping
    const statusColorMap: Record<string, string> = {
        active: "bg-green-500",
        refreshing: "bg-blue-400 animate-pulse",
        suspended: "bg-yellow-500",
        error: "bg-red-500",
        disabled: "bg-gray-500",
    };

    // Decide if we have data to show
    const hasWidgetData =
        sourceData?.data && component.widgets && component.widgets.length > 0;
    const hasNoData = !hasWidgetData;

    return (
        <Card className="bg-card border-border flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                    {ui.icon && <span className="text-xl">{ui.icon}</span>}
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        {ui.title}
                    </CardTitle>
                </div>
                {/* Status Dot - only visual indicator for refresh/error/etc */}
                <div
                    title={`Status: ${dotStatus}`}
                    className={`w-2.5 h-2.5 rounded-full ${statusColorMap[dotStatus] || "bg-gray-500"} shrink-0 ml-2`}
                />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col pt-2 pb-4">
                {/* Always render widgets if data exists */}
                {hasWidgetData && (
                    <div className="flex flex-col gap-5 h-full pt-1">
                        {component.widgets!.map((widget, idx) => (
                            <WidgetRenderer
                                key={idx}
                                widget={widget}
                                data={sourceData!.data!}
                            />
                        ))}
                    </div>
                )}

                {/* No data placeholder */}
                {hasNoData && (
                    <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground py-6 min-h-[120px]">
                        暂无数据
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
