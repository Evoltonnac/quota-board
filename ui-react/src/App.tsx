import { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { api } from "./api/client";
import type {
    StoredView,
    SourceSummary,
    DataResponse,
    ViewComponent,
} from "./types/config";
import {
    RefreshCw,
    Activity,
    Database,
    MoreVertical,
    Settings,
    FileJson,
    Pencil,
    ArrowLeft,
    ArrowRight,
    Plus,
    Minus,
    Trash2,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./components/ui/tooltip";
import { QuotaCard } from "./components/QuotaCard";
import { StatGrid } from "./components/StatGrid";
import { FlowHandler } from "./components/auth/FlowHandler";
import { OAuthCallback } from "./components/auth/OAuthCallback";
import { BaseSourceCard } from "./components/BaseSourceCard";
import { AddWidgetDialog } from "./components/AddWidgetDialog";
import IntegrationsPage from "./pages/Integrations";

// Format value helper
function formatValue(value: any, format?: string): string {
    if (value === undefined || value === null) return "N/A";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return String(value);

    if (format) {
        if (format.includes("{value}")) {
            return format.replace(/\{value\}/g, numValue.toFixed(2));
        }
        return format
            .replace(/%/g, "")
            .replace("$", "$")
            .replace("f", numValue.toFixed(2));
    }

    if (numValue >= 1000000) return (numValue / 1000000).toFixed(2) + "M";
    if (numValue >= 1000) return (numValue / 1000).toFixed(2) + "K";
    return numValue.toFixed(2);
}

// Determine status based on usage percentage
function getStatus(
    usage: number,
    limit: number,
): "ok" | "warning" | "critical" | "error" {
    if (!limit || limit === 0) return "error";
    const percentage = (usage / limit) * 100;
    if (percentage >= 90) return "critical";
    if (percentage >= 75) return "warning";
    return "ok";
}

// Render component based on type
function renderComponent(
    comp: ViewComponent,
    sourceData: DataResponse | null,
    index: number,
    sourceSummary?: SourceSummary,
    onInteract?: (source: SourceSummary) => void,
) {
    const data = sourceData?.data || {};
    const error = sourceData?.error;

    // Handle use_group (component groups)
    if (comp.use_group) {
        return renderComponentGroup(comp, sourceData, index);
    }

    switch (comp.type) {
        case "source_card":
            return (
                <BaseSourceCard
                    key={index}
                    component={comp}
                    sourceSummary={sourceSummary}
                    sourceData={sourceData}
                    onInteract={onInteract}
                />
            );

        case "quota_card":
            return (
                <QuotaCard
                    key={index}
                    title={comp.label}
                    data={data}
                    limitField={comp.limit_field}
                    usageField={comp.usage_field}
                    remainingField={comp.remaining_field}
                    format={comp.format}
                    status={getStatus(
                        (data.usage as number) || 0,
                        (data.limit as number) || 0,
                    )}
                />
            );

        case "stat_grid":
            return (
                <StatGrid
                    key={index}
                    title={comp.label}
                    items={comp.items || []}
                    data={data}
                    columns={comp.columns || 4}
                />
            );

        case "metric":
            return (
                <Card key={index} className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {comp.label || comp.field}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatValue(data[comp.field || ""], comp.format)}
                        </div>
                    </CardContent>
                </Card>
            );

        case "badge":
            const boolValue = data[comp.field || ""];
            const badgeLabel =
                typeof boolValue === "boolean"
                    ? boolValue
                        ? comp.true_label || "True"
                        : comp.false_label || "False"
                    : boolValue;
            return (
                <Badge
                    key={index}
                    variant={
                        String(boolValue)?.toLowerCase() === "true" ||
                        String(boolValue)?.toLowerCase() ===
                            comp.true_label?.toLowerCase()
                            ? "success"
                            : "secondary"
                    }
                >
                    {badgeLabel}
                </Badge>
            );

        case "progress_bar":
            const value =
                data[comp.value_field || ""] || data[comp.field || ""];
            const max = data[comp.max_field || ""] || data.limit || 100;
            const percentage = max ? ((value as number) / max) * 100 : 0;
            return (
                <Card key={index} className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {comp.label}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="w-full bg-secondary rounded-full h-2">
                            <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{
                                    width: `${Math.min(100, percentage)}%`,
                                }}
                            />
                        </div>
                        <div className="text-right text-xs text-muted-foreground mt-1">
                            {percentage.toFixed(1)}%
                        </div>
                    </CardContent>
                </Card>
            );

        case "json":
            return (
                <Card key={index} className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {comp.label}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-xs overflow-auto max-h-40 text-muted-foreground">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            );

        default:
            return (
                <Card key={index} className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {comp.label || comp.field || comp.type}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold">
                            {String(data[comp.field || ""] || "N/A")}
                        </div>
                        {error && (
                            <div className="text-xs text-destructive mt-2">
                                Error: {error}
                            </div>
                        )}
                    </CardContent>
                </Card>
            );
    }
}

// Render component group (multiple components from a group)
function renderComponentGroup(
    comp: ViewComponent & {
        use_group?: string;
        group_vars?: Record<string, string>;
    },
    sourceData: DataResponse | null,
    index: number,
) {
    // For now, render as QuotaCard when group is specified
    const data = sourceData?.data || {};
    const groupVars = comp.group_vars || {};

    return (
        <QuotaCard
            key={index}
            title={groupVars.label || comp.label}
            data={data}
            format={comp.format || "${value:.4f}"}
            showProgress={true}
            status={getStatus(
                (data.usage as number) || 0,
                (data.limit as number) || 0,
            )}
        />
    );
}

function Dashboard() {
    const [viewConfig, setViewConfig] = useState<StoredView | null>(null);
    const [sources, setSources] = useState<SourceSummary[]>([]);
    const [dataMap, setDataMap] = useState<Record<string, DataResponse>>({});
    const [loading, setLoading] = useState(true);

    // Ref to prevent duplicate requests in StrictMode
    const loadingRef = useRef(false);

    // Interaction state
    const [interactSource, setInteractSource] = useState<SourceSummary | null>(
        null,
    );

    // Add Widget Dialog State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    // Edit Layout State
    const [isEditMode, setIsEditMode] = useState(false);

    const loadData = async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        try {
            const [views, sourcesData] = await Promise.all([
                api.getViews(),
                api.getSources(),
            ]);

            // For now, assume a single default view or the first one
            const activeView = views.length > 0 ? views[0] : null;
            setViewConfig(activeView);
            setSources(sourcesData);

            const dataPromises = sourcesData.map((s) =>
                api
                    .getSourceData(s.id)
                    .then((data: any) => ({ id: s.id, data })),
            );
            const results = await Promise.all(dataPromises);
            const newDataMap: Record<string, DataResponse> = {};
            results.forEach(({ id, data }) => {
                newDataMap[id] = data;
            });
            setDataMap(newDataMap);
        } catch (error) {
            console.error("加载数据失败:", error);
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    };

    const handleAddWidget = async (
        sourceId: string,
        template: ViewComponent,
    ) => {
        let currentView = viewConfig;
        let isNewView = false;

        if (!currentView) {
            currentView = {
                id: `view-${Date.now()}`,
                name: "默认监控面板",
                layout_columns: 12,
                items: [],
            };
            isNewView = true;
        }

        // Ensure each item has a unique ID in the layout
        const newItemId = `widget-${Date.now()}`;

        const newItem = {
            id: newItemId,
            w: 4,
            h: 4,
            source_id: sourceId,
            template_id: template.label || template.type || "",
            props: { ...template },
        };

        const updatedView = {
            ...currentView,
            items: [...currentView.items, newItem],
        };

        try {
            // Optimistic update
            setViewConfig(updatedView);

            // Save to backend
            if (isNewView) {
                await api.createView(updatedView);
            } else {
                await api.updateView(updatedView.id, updatedView);
            }

            setTimeout(loadData, 500); // Reload data to get anything new
        } catch (error) {
            console.error("Failed to add widget:", error);
            // Revert on error
            setViewConfig(viewConfig);
        }
    };

    const handleUpdateWidgetSize = async (
        index: number,
        dw: number,
        dh: number,
    ) => {
        if (!viewConfig) return;
        const newItems = [...viewConfig.items];
        const item = newItems[index];
        const newW = Math.max(
            1,
            Math.min(viewConfig.layout_columns, item.w + dw),
        );
        const newH = Math.max(1, item.h + dh);
        if (newW === item.w && newH === item.h) return;

        newItems[index] = { ...item, w: newW, h: newH };
        const updatedView = { ...viewConfig, items: newItems };

        // Optimistic
        setViewConfig(updatedView);
        api.updateView(updatedView.id, updatedView).catch((e) =>
            console.error(e),
        );
    };

    const handleMoveWidget = async (
        index: number,
        direction: "up" | "down",
    ) => {
        if (!viewConfig) return;
        const newItems = [...viewConfig.items];
        if (direction === "up" && index > 0) {
            [newItems[index - 1], newItems[index]] = [
                newItems[index],
                newItems[index - 1],
            ];
        } else if (direction === "down" && index < newItems.length - 1) {
            [newItems[index], newItems[index + 1]] = [
                newItems[index + 1],
                newItems[index],
            ];
        } else {
            return;
        }

        const updatedView = { ...viewConfig, items: newItems };
        setViewConfig(updatedView);
        api.updateView(updatedView.id, updatedView).catch((e) =>
            console.error(e),
        );
    };

    const handleDeleteWidget = async (index: number) => {
        if (!viewConfig) return;
        const newItems = viewConfig.items.filter((_, i) => i !== index);
        const updatedView = { ...viewConfig, items: newItems };
        setViewConfig(updatedView);
        api.updateView(updatedView.id, updatedView).catch((e) =>
            console.error(e),
        );
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRefreshAll = async () => {
        try {
            await api.refreshAll();
            setTimeout(loadData, 2000);
        } catch (error) {
            console.error("刷新失败:", error);
        }
    };

    if (loading) {
        return (
            <TooltipProvider>
                <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
                    <Card className="w-[350px]">
                        <CardHeader className="text-center">
                            <CardTitle>加载中...</CardTitle>
                            <CardDescription>
                                正在获取配置和数据
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex justify-center">
                            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                        </CardContent>
                    </Card>
                </div>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider>
            <div className="min-h-screen bg-background text-foreground">
                {/* Header */}
                <header className="border-b border-border px-6 py-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Activity className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">
                                    {viewConfig?.name || "Quota Board"}
                                </h1>
                                <p className="text-xs text-muted-foreground">
                                    配额监控面板
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRefreshAll}
                                    >
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        刷新全部
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>重新获取所有数据源的配额数据</p>
                                </TooltipContent>
                            </Tooltip>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <Link
                                            to="/integrations"
                                            className="flex items-center"
                                        >
                                            <FileJson className="mr-2 h-4 w-4" />
                                            集成管理
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                        <Settings className="mr-2 h-4 w-4" />
                                        系统设置
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>关于</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </header>

                <div className="flex">
                    {/* Sidebar */}
                    <aside className="w-64 border-r border-border bg-card/30 min-h-[calc(100vh-73px)] p-4 hidden md:block">
                        <div className="flex items-center gap-2 mb-4">
                            <Database className="w-4 h-4 text-muted-foreground" />
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                数据源状态
                            </h2>
                        </div>
                        <div className="space-y-2">
                            {sources.map((source) => (
                                <Card
                                    key={source.id}
                                    className="bg-secondary/50 border-border/50"
                                >
                                    <CardContent className="p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm truncate">
                                                {source.name}
                                            </span>
                                            <Badge
                                                variant={
                                                    source.has_data
                                                        ? "success"
                                                        : source.error
                                                          ? "destructive"
                                                          : "secondary"
                                                }
                                            >
                                                {source.has_data
                                                    ? "正常"
                                                    : source.error
                                                      ? "错误"
                                                      : source.status ===
                                                          "suspended"
                                                        ? "需操作"
                                                        : "等待"}
                                            </Badge>
                                        </div>
                                        {source.status === "suspended" && (
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="w-full mt-2"
                                                onClick={() =>
                                                    setInteractSource(source)
                                                }
                                            >
                                                解决问题
                                            </Button>
                                        )}
                                        {source.error && (
                                            <div className="mt-2">
                                                <p className="text-xs text-destructive line-clamp-2">
                                                    {source.error}
                                                </p>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="w-full mt-2 h-7"
                                                    onClick={() =>
                                                        setInteractSource(
                                                            source,
                                                        )
                                                    } // Allow opening generic handler or specialized retry
                                                >
                                                    重试 / 详情
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold">监控视图</h2>
                            <div className="flex gap-2">
                                <Button
                                    variant={
                                        isEditMode ? "secondary" : "outline"
                                    }
                                    size="sm"
                                    onClick={() => setIsEditMode(!isEditMode)}
                                >
                                    <Pencil className="w-4 h-4 mr-1" />
                                    {isEditMode ? "完成编辑" : "编辑排布"}
                                </Button>
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => setIsAddDialogOpen(true)}
                                >
                                    + 添加小组件
                                </Button>
                            </div>
                        </div>

                        {!viewConfig || viewConfig.items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-card/30">
                                <p className="text-muted-foreground mb-4">
                                    当前视图还没有任何组件。
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsAddDialogOpen(true)}
                                >
                                    添加第一个组件
                                </Button>
                            </div>
                        ) : (
                            <div
                                className="grid gap-4 grid-flow-row-dense"
                                style={{
                                    gridTemplateColumns: `repeat(${viewConfig.layout_columns || 12}, minmax(0, 1fr))`,
                                    gridAutoRows: "minmax(80px, auto)",
                                }}
                            >
                                {viewConfig.items.map((item, index) => {
                                    const sourceData = item.source_id
                                        ? dataMap[item.source_id]
                                        : null;
                                    const sourceSummary = item.source_id
                                        ? sources.find(
                                              (s) => s.id === item.source_id,
                                          )
                                        : undefined;

                                    const comp: ViewComponent = {
                                        type: (item.props?.type ||
                                            item.template_id ||
                                            "source_card") as any,
                                        label:
                                            item.props?.label ||
                                            item.template_id,
                                        ...item.props,
                                    };

                                    return (
                                        <div
                                            key={index}
                                            style={{
                                                gridColumn: `span ${item.w}`,
                                                gridRow: `span ${item.h}`,
                                                display: "flex", // ensure children can fill
                                                flexDirection: "column",
                                            }}
                                            className={`min-h-0 relative ${isEditMode ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl" : ""}`}
                                        >
                                            <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col [&>div]:h-full [&>div]:flex-1">
                                                {renderComponent(
                                                    comp,
                                                    sourceData,
                                                    index,
                                                    sourceSummary,
                                                    setInteractSource,
                                                )}
                                            </div>

                                            {isEditMode && (
                                                <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-10 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                    <div className="bg-background border border-border rounded-lg shadow-xl p-3 flex flex-col gap-3 min-w-[160px]">
                                                        <div className="flex items-center justify-between gap-4">
                                                            <span className="text-xs font-medium text-foreground">
                                                                排序
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    size="icon"
                                                                    variant="outline"
                                                                    className="h-6 w-6"
                                                                    onClick={() =>
                                                                        handleMoveWidget(
                                                                            index,
                                                                            "up",
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        index ===
                                                                        0
                                                                    }
                                                                >
                                                                    <ArrowLeft className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="outline"
                                                                    className="h-6 w-6"
                                                                    onClick={() =>
                                                                        handleMoveWidget(
                                                                            index,
                                                                            "down",
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        index ===
                                                                        viewConfig
                                                                            .items
                                                                            .length -
                                                                            1
                                                                    }
                                                                >
                                                                    <ArrowRight className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4">
                                                            <span className="text-xs font-medium text-foreground">
                                                                宽度 ({item.w})
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    size="icon"
                                                                    variant="outline"
                                                                    className="h-6 w-6"
                                                                    onClick={() =>
                                                                        handleUpdateWidgetSize(
                                                                            index,
                                                                            -1,
                                                                            0,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        item.w <=
                                                                        1
                                                                    }
                                                                >
                                                                    <Minus className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="outline"
                                                                    className="h-6 w-6"
                                                                    onClick={() =>
                                                                        handleUpdateWidgetSize(
                                                                            index,
                                                                            1,
                                                                            0,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        item.w >=
                                                                        viewConfig.layout_columns
                                                                    }
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4">
                                                            <span className="text-xs font-medium text-foreground">
                                                                高度 ({item.h})
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    size="icon"
                                                                    variant="outline"
                                                                    className="h-6 w-6"
                                                                    onClick={() =>
                                                                        handleUpdateWidgetSize(
                                                                            index,
                                                                            0,
                                                                            -1,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        item.h <=
                                                                        1
                                                                    }
                                                                >
                                                                    <Minus className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    size="icon"
                                                                    variant="outline"
                                                                    className="h-6 w-6"
                                                                    onClick={() =>
                                                                        handleUpdateWidgetSize(
                                                                            index,
                                                                            0,
                                                                            1,
                                                                        )
                                                                    }
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="w-full h-7 mt-1 text-xs"
                                                            onClick={() =>
                                                                handleDeleteWidget(
                                                                    index,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="h-3 w-3 mr-1" />{" "}
                                                            删除
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </main>
                </div>
            </div>

            <AddWidgetDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onAddWidget={handleAddWidget}
            />

            <FlowHandler
                source={interactSource}
                isOpen={!!interactSource}
                onClose={() => setInteractSource(null)}
                onInteractSuccess={() => {
                    // Refresh data after successful interaction
                    setTimeout(loadData, 1000);
                }}
            />
        </TooltipProvider>
    );
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/oauth/callback" element={<OAuthCallback />} />
                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/" element={<Dashboard />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
