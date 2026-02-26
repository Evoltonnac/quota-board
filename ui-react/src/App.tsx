import { useEffect, useState, useRef, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { GridStack } from "gridstack";
import "gridstack/dist/gridstack.min.css";
import { api } from "./api/client";
import type {
    StoredView,
    ViewItem,
    SourceSummary,
    DataResponse,
    ViewComponent,
} from "./types/config";
import {
    RefreshCw,
    Database,
    MoreVertical,
    Trash2,
    ExternalLink,
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "./components/ui/dialog";
import { TooltipProvider } from "./components/ui/tooltip";
import { QuotaCard } from "./components/QuotaCard";
import { StatGrid } from "./components/StatGrid";
import { FlowHandler } from "./components/auth/FlowHandler";
import { OAuthCallback } from "./components/auth/OAuthCallback";
import { BaseSourceCard } from "./components/BaseSourceCard";
import { AddWidgetDialog } from "./components/AddWidgetDialog";
import IntegrationsPage from "./pages/Integrations";
import { TopNav } from "./components/TopNav";

// GridStack layout constants — keep in sync with --qb-row-height / --qb-grid-margin in index.css
const GRID_ROW_HEIGHT = 80;
const GRID_MARGIN = 8;

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

// Delete button shown on header hover
function DeleteBtn({ onDelete }: { onDelete?: () => void }) {
    if (!onDelete) return null;
    return (
        <button
            className="qb-delete-btn shrink-0 ml-2 opacity-0 group-hover/card:opacity-100 transition-opacity rounded p-0.5 text-muted-foreground hover:text-destructive-foreground hover:bg-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="删除"
        >
            <Trash2 className="h-3 w-3" />
        </button>
    );
}

// Render component based on type
function renderComponent(
    comp: ViewComponent,
    sourceData: DataResponse | null,
    index: number,
    sourceSummary?: SourceSummary,
    onInteract?: (source: SourceSummary) => void,
    onDelete?: () => void,
) {
    const data = sourceData?.data || {};
    const error = sourceData?.error;

    // Handle use_group (component groups)
    if (comp.use_group) {
        return renderComponentGroup(comp, sourceData, index, onDelete);
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
                    onDelete={onDelete}
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
                    onDelete={onDelete}
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
                    onDelete={onDelete}
                />
            );

        case "metric":
            return (
                <Card
                    key={index}
                    className="bg-card border-border flex flex-col h-full overflow-hidden"
                >
                    <div
                        className="qb-card-header flex-shrink-0 flex items-center justify-between px-3 border-b border-border/40 bg-card"
                        style={{ height: "var(--qb-card-header-height)" }}
                    >
                        <span className="text-xs font-medium text-muted-foreground truncate">
                            {comp.label || comp.field}
                        </span>
                        <DeleteBtn onDelete={onDelete} />
                    </div>
                    <CardContent className="flex-1 overflow-auto min-h-0 flex flex-col justify-center px-3 py-2">
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
                <Card
                    key={index}
                    className="bg-card border-border flex flex-col h-full overflow-hidden"
                >
                    <div
                        className="qb-card-header flex-shrink-0 flex items-center justify-between px-3 border-b border-border/40 bg-card"
                        style={{ height: "var(--qb-card-header-height)" }}
                    >
                        <span className="text-xs font-medium text-muted-foreground truncate">
                            {comp.label}
                        </span>
                        <DeleteBtn onDelete={onDelete} />
                    </div>
                    <CardContent className="flex-1 overflow-auto min-h-0 flex flex-col justify-center px-3 py-2">
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
                <Card
                    key={index}
                    className="bg-card border-border flex flex-col h-full overflow-hidden"
                >
                    <div
                        className="qb-card-header flex-shrink-0 flex items-center justify-between px-3 border-b border-border/40 bg-card"
                        style={{ height: "var(--qb-card-header-height)" }}
                    >
                        <span className="text-xs font-medium text-muted-foreground truncate">
                            {comp.label}
                        </span>
                        <DeleteBtn onDelete={onDelete} />
                    </div>
                    <CardContent className="flex-1 overflow-auto min-h-0 px-3 py-2">
                        <pre className="text-xs text-muted-foreground">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            );

        default:
            return (
                <Card
                    key={index}
                    className="bg-card border-border flex flex-col h-full overflow-hidden"
                >
                    <div
                        className="qb-card-header flex-shrink-0 flex items-center justify-between px-3 border-b border-border/40 bg-card"
                        style={{ height: "var(--qb-card-header-height)" }}
                    >
                        <span className="text-xs font-medium text-muted-foreground truncate">
                            {comp.label || comp.field || comp.type}
                        </span>
                        <DeleteBtn onDelete={onDelete} />
                    </div>
                    <CardContent className="flex-1 overflow-auto min-h-0 px-3 py-2">
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
    onDelete?: () => void,
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
            onDelete={onDelete}
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

    // Delete Source Dialog State
    const [deletingSourceId, setDeletingSourceId] = useState<string | null>(
        null,
    );

    // GridStack ref
    const gridRef = useRef<HTMLDivElement>(null);
    const gsInstanceRef = useRef<GridStack | null>(null);

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

        const newItem: ViewItem = {
            id: newItemId,
            x: 0,
            y: 999, // large y so GridStack auto-places at bottom
            w: 4,
            h: 2,
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

    const handleDeleteWidget = async (itemId: string) => {
        if (!viewConfig) return;
        const newItems = viewConfig.items.filter((it) => it.id !== itemId);
        const updatedView = { ...viewConfig, items: newItems };
        setViewConfig(updatedView);

        // Also remove from GridStack DOM
        const gs = gsInstanceRef.current;
        if (gs) {
            const el = gridRef.current?.querySelector(`[gs-id="${itemId}"]`);
            if (el) gs.removeWidget(el as HTMLElement, false);
        }

        api.updateView(updatedView.id, updatedView).catch((e) =>
            console.error(e),
        );
    };

    // Use a ref to always access the latest viewConfig in event handlers
    const viewConfigRef = useRef(viewConfig);
    useEffect(() => {
        viewConfigRef.current = viewConfig;
    }, [viewConfig]);

    // Sync GridStack changes back to state/backend
    const handleGridChange = useCallback(() => {
        const gs = gsInstanceRef.current;
        const currentViewConfig = viewConfigRef.current;
        if (!gs || !currentViewConfig) return;

        const nodes = gs
            .getGridItems()
            .map((el) => ({
                id: el.getAttribute("gs-id") || "",
                x: parseInt(el.getAttribute("gs-x") || "0"),
                y: parseInt(el.getAttribute("gs-y") || "0"),
                w: parseInt(el.getAttribute("gs-w") || "4"),
                h: parseInt(el.getAttribute("gs-h") || "2"),
            }))
            .filter((n) => n.id !== ""); // Filter out phantom nodes without gs-id

        // Merge coordinates back into viewConfig items
        const updatedItems = currentViewConfig.items.map((item) => {
            const node = nodes.find((n) => n.id === item.id);
            if (node) {
                return { ...item, x: node.x, y: node.y, w: node.w, h: node.h };
            }
            return item;
        });

        const updatedView = { ...currentViewConfig, items: updatedItems };
        setViewConfig(updatedView);
        api.updateView(updatedView.id, updatedView).catch((e) =>
            console.error(e),
        );
    }, []); // No dependencies needed — uses refs for latest state

    // Initialize and update GridStack
    useEffect(() => {
        if (!gridRef.current || !viewConfig || viewConfig.items.length === 0)
            return;

        const gs = gsInstanceRef.current;
        if (!gs) {
            // First init — always enabled (no edit mode toggle)
            const instance = GridStack.init(
                {
                    column: viewConfig.layout_columns || 12,
                    cellHeight: GRID_ROW_HEIGHT,
                    margin: GRID_MARGIN,
                    float: false,
                    animate: true,
                    draggable: { handle: ".qb-card-header" },
                },
                gridRef.current,
            );
            gsInstanceRef.current = instance;
            instance.on("change", handleGridChange);
        }

        return () => {
            // Don't destroy on every render
        };
    }, [viewConfig?.items.length, handleGridChange]);

    useEffect(() => {
        loadData();
    }, []);

    // Monitor for global refresh event
    useEffect(() => {
        const onRefresh = async () => {
            // If a scraper is running, cancel it first so its result won't race with the new tasks
            if (activeScraperRef.current) {
                console.log(
                    `[Scraper] Global refresh: cancelling active task for ${activeScraperRef.current}`,
                );
                activeScraperRef.current = null; // clear ref immediately so scraper_result is discarded
                try {
                    await invoke("cancel_scraper_task");
                } catch (e) {
                    console.error("Failed to cancel on global refresh:", e);
                }
            }

            // OPTIMISTIC UPDATE: Mark all current sources as refreshing
            setSources((prev) =>
                prev.map((s) => ({ ...s, status: "refreshing" })),
            );

            // Clear skipped scrapers on global refresh so webview tasks can be re-queued
            setSkippedScrapers(new Set());
            setActiveScraper(null);

            // No need to call loadData() immediately because the polling effect will pick up the 'refreshing' status
            // and fetch the actual current status from backend.
            await api
                .refreshAll()
                .catch((e) => console.error("Refresh all failed:", e));
        };
        window.addEventListener("app:refresh_data", onRefresh);
        return () => window.removeEventListener("app:refresh_data", onRefresh);
    }, []);

    // --- Scraper Queue Management ---
    const [activeScraper, setActiveScraper] = useState<string | null>(null);
    // Ref to track the *current* active scraper ID synchronously.
    // This is critical for the scraper_result event listener (which is a stale closure)
    // to guard against processing results from cancelled/superseded tasks.
    const activeScraperRef = useRef<string | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        activeScraperRef.current = activeScraper;
    }, [activeScraper]);

    const [skippedScrapers, setSkippedScrapers] = useState<Set<string>>(
        new Set(),
    );

    // Dynamic Polling for refreshing sources
    useEffect(() => {
        const refreshingSources = sources.filter(
            (s) => s.status === "refreshing",
        );
        if (refreshingSources.length === 0) return;

        console.log(
            `[Polling] ${refreshingSources.length} sources are refreshing...`,
        );

        const interval = setInterval(async () => {
            try {
                const updatedSources = await api.getSources();

                // Find sources that just finished refreshing
                const finishedIds = refreshingSources
                    .filter((oldS) => {
                        const newS = updatedSources.find(
                            (s) => s.id === oldS.id,
                        );
                        return newS && newS.status !== "refreshing";
                    })
                    .map((s) => s.id);

                if (finishedIds.length > 0) {
                    console.log(
                        `[Polling] Sources finished refreshing:`,
                        finishedIds,
                    );
                    // Update the sources list to reflect new statuses
                    setSources(updatedSources);

                    // Trigger data load for these specific sources
                    const dataPromises = finishedIds.map(async (id) => {
                        const data = await api.getSourceData(id);
                        setDataMap((prev) => ({ ...prev, [id]: data }));
                    });
                    await Promise.all(dataPromises);
                } else {
                    // Update sources anyway to keep UI in sync if backend finally reported 'refreshing'
                    // (in case our optimistic update was too fast and the first getSources saw the old status)
                    setSources(updatedSources);
                }
            } catch (error) {
                console.error("Polling failed:", error);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [sources]);

    // Compute the current queue of webview scrapers
    const webviewQueue = sources.filter(
        (source) =>
            source.status === "suspended" &&
            source.interaction?.type === "webview_scrape" &&
            !skippedScrapers.has(source.id),
    );

    // Cleanup zombie active scraper if its status changed elsewhere
    useEffect(() => {
        if (activeScraper) {
            const activeSource = sources.find((s) => s.id === activeScraper);
            if (!activeSource || activeSource.status !== "suspended") {
                console.log(
                    "Cleaning up zombie active scraper:",
                    activeScraper,
                );
                setActiveScraper(null);
                invoke("cancel_scraper_task").catch(console.error);
            }
        }
    }, [sources, activeScraper]);

    // Monitor for background scraper tasks
    useEffect(() => {
        // If we already have an active scraper, don't start another one
        if (activeScraper) return;

        // Pull the next available scraper from the queue
        const nextSource = webviewQueue.length > 0 ? webviewQueue[0] : null;

        if (nextSource) {
            const { url, script, intercept_api, secret_key } =
                nextSource.interaction?.data || {};

            console.log(
                `Starting scraper for ${nextSource.name} (${nextSource.id})`,
            );
            setActiveScraper(nextSource.id);

            // Dispatch to Tauri Backend
            invoke("push_scraper_task", {
                sourceId: nextSource.id,
                url: url,
                injectScript: script,
                interceptApi: intercept_api,
                secretKey: secret_key,
            }).catch((err) => {
                console.error("Failed to push scraper task to Tauri:", err);
                setActiveScraper(null); // Reset on failure so we can try again or try next
            });
        }
    }, [webviewQueue, activeScraper]);

    const handleSkipScraper = async () => {
        if (!activeScraper) return;

        try {
            // Cancel the backend task
            await invoke("cancel_scraper_task");
        } catch (error) {
            console.error("Failed to cancel scraper task:", error);
        }

        // Add to skipped list and clear active so the next one can start
        setSkippedScrapers((prev) => new Set(prev).add(activeScraper));
        setActiveScraper(null);
    };

    const handleClearScraperQueue = async () => {
        // Cancel if there's an active one
        if (activeScraper) {
            try {
                await invoke("cancel_scraper_task");
            } catch (error) {
                console.error("Failed to cancel active scraper task:", error);
            }
        }

        // Add all current queue items to skipped
        setSkippedScrapers((prev) => {
            const newSkipped = new Set(prev);
            if (activeScraper) newSkipped.add(activeScraper);
            webviewQueue.forEach((s) => newSkipped.add(s.id));
            return newSkipped;
        });
        setActiveScraper(null);
    };

    // Push a webview scrape source to the queue manually (e.g., from FlowHandler dialog)
    // Returns true if successfully added, false if already in queue
    const handlePushToQueue = (source: SourceSummary): boolean => {
        // Check if already active
        if (activeScraper === source.id) {
            alert(`"${source.name}" 的抓取任务已在运行中。`);
            return false;
        }
        // Check if already in queue (not skipped)
        const alreadyInQueue = webviewQueue.some((s) => s.id === source.id);
        if (alreadyInQueue) {
            alert(`"${source.name}" 已在抓取队列中，请勿重复添加。`);
            return false;
        }
        // Remove from skipped so it can be picked up by the queue effect
        setSkippedScrapers((prev) => {
            const next = new Set(prev);
            next.delete(source.id);
            return next;
        });
        console.log(`手动将 ${source.name} (${source.id}) 加入抓取队列`);
        return true;
    };

    // Setup global listeners from Tauri
    useEffect(() => {
        let unlistenScraperResult: (() => void) | undefined;
        let unlistenAuthRequired: (() => void) | undefined;

        listen<{
            sourceId: string;
            data: any;
            error?: string;
            secretKey: string;
        }>("scraper_result", async (event) => {
            const { sourceId, data, error, secretKey } = event.payload;

            // GUARD: If the result is not from the current active scraper (e.g., it was
            // cancelled due to a global refresh), discard it to prevent duplicate interact calls.
            if (activeScraperRef.current !== sourceId) {
                console.warn(
                    `[Scraper] Discarding stale result for ${sourceId} (current active: ${activeScraperRef.current})`,
                );
                return;
            }

            // Prevent it from being immediately picked up again before reload
            setSkippedScrapers((prev) => new Set(prev).add(sourceId));

            // Allow next scraper to run
            setActiveScraper(null);
            activeScraperRef.current = null;

            if (error) {
                console.error(`Scraper error for ${sourceId}:`, error);
                return;
            }
            try {
                // Send scraped data back to Python Core
                await api.interact(sourceId, { [secretKey]: data });
                // Optimistically mark as refreshing
                setSources((prev) =>
                    prev.map((s) =>
                        s.id === sourceId ? { ...s, status: "refreshing" } : s,
                    ),
                );
            } catch (err) {
                console.error(
                    `Failed to post scraped data for ${sourceId}:`,
                    err,
                );
            }
        }).then((unlisten) => {
            unlistenScraperResult = unlisten;
        });

        listen<{ sourceId: string; targetUrl: string }>(
            "scraper_auth_required",
            (event) => {
                console.log(
                    `Manual auth required for source ${event.payload.sourceId}`,
                );
                // The Rust backend should show the Webview.
                // We can perhaps pop up a notification here telling the user to log in on the opened window.
            },
        ).then((unlisten) => {
            unlistenAuthRequired = unlisten;
        });

        return () => {
            if (unlistenScraperResult) unlistenScraperResult();
            if (unlistenAuthRequired) unlistenAuthRequired();
        };
    }, []);

    const handleShowScraperWindow = async () => {
        try {
            await invoke("show_scraper_window");
        } catch (error) {
            console.error("Failed to show scraper window:", error);
        }
    };

    const handleRefreshSource = async (sourceId: string) => {
        // If this source is currently being scraped, cancel the task first
        // so its result won't race with the fresh new task
        if (activeScraperRef.current === sourceId) {
            console.log(
                `[Scraper] Refresh: cancelling active task for ${sourceId}`,
            );
            activeScraperRef.current = null; // clear ref immediately to discard any in-flight result
            setActiveScraper(null);
            try {
                await invoke("cancel_scraper_task");
            } catch (e) {
                console.error("Failed to cancel on source refresh:", e);
            }
        }
        // Optimistic feedback
        setSources((prev) =>
            prev.map((s) =>
                s.id === sourceId ? { ...s, status: "refreshing" } : s,
            ),
        );
        // Remove from skipped scrapers so that if it goes back to suspended,
        // the queue effect will pick it up automatically
        setSkippedScrapers((prev) => {
            const next = new Set(prev);
            next.delete(sourceId);
            return next;
        });
        try {
            await api.refreshSource(sourceId);
        } catch (error) {
            console.error(`刷新数据源 ${sourceId} 失败:`, error);
        }
    };

    const handleDeleteSource = async (sourceId: string) => {
        try {
            await api.deleteSourceFile(sourceId);
            setDeletingSourceId(null);
            setTimeout(loadData, 500);
        } catch (error) {
            console.error(`删除数据源 ${sourceId} 失败:`, error);
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
            <div className="h-full bg-background text-foreground flex overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 border-r border-border bg-card/30 flex-col hidden md:flex">
                    <div className="p-4 border-b border-border flex items-center gap-2">
                        <Database className="w-4 h-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            数据源状态
                        </h2>
                    </div>

                    <div className="space-y-2 p-4 overflow-y-auto flex-1">
                        {sources.map((source) => (
                            <Card
                                key={source.id}
                                className="bg-secondary/50 border-border/50"
                            >
                                <CardContent className="p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 overflow-hidden max-w-[120px]">
                                            <span className="font-medium text-sm truncate">
                                                {source.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Badge
                                                variant={
                                                    (source.status as string) ===
                                                    "refreshing"
                                                        ? "default"
                                                        : source.has_data
                                                          ? "success"
                                                          : source.error
                                                            ? "destructive"
                                                            : "secondary"
                                                }
                                            >
                                                {(source.status as string) ===
                                                "refreshing"
                                                    ? "刷新中"
                                                    : source.has_data
                                                      ? "正常"
                                                      : source.error
                                                        ? "错误"
                                                        : (source.status as string) ===
                                                            "suspended"
                                                          ? "需操作"
                                                          : "等待"}
                                            </Badge>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                    >
                                                        <MoreVertical className="h-3 w-3" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onSelect={(e) => {
                                                            e.preventDefault();
                                                            handleRefreshSource(
                                                                source.id,
                                                            );
                                                        }}
                                                    >
                                                        <RefreshCw className="mr-2 h-4 w-4" />
                                                        刷新
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onSelect={(e) => {
                                                            e.preventDefault();
                                                            setDeletingSourceId(
                                                                source.id,
                                                            );
                                                        }}
                                                        className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        删除
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
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
                                            {source.interaction?.type ===
                                            "webview_scrape"
                                                ? "加入抓取队列"
                                                : "解决问题"}
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
                                                    setInteractSource(source)
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

                    <Dialog
                        open={deletingSourceId !== null}
                        onOpenChange={(open) =>
                            !open && setDeletingSourceId(null)
                        }
                    >
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>确认删除</DialogTitle>
                                <DialogDescription>
                                    确定要删除此数据源吗？相关配置和本地数据也将被清除，此操作不可撤销。
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setDeletingSourceId(null)}
                                >
                                    取消
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() =>
                                        deletingSourceId &&
                                        handleDeleteSource(deletingSourceId)
                                    }
                                >
                                    确认删除
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6 overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold">监控视图</h2>
                        <div className="flex gap-2">
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
                        <div ref={gridRef} className="grid-stack">
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
                                        item.props?.label || item.template_id,
                                    ...item.props,
                                };

                                return (
                                    <div
                                        key={item.id}
                                        className="grid-stack-item"
                                        gs-id={item.id}
                                        gs-x={item.x ?? 0}
                                        gs-y={item.y ?? 0}
                                        gs-w={item.w ?? 4}
                                        gs-h={item.h ?? 2}
                                    >
                                        <div className="grid-stack-item-content relative overflow-hidden group/card">
                                            {/* Full-height pass-through — card components fill via h-full flex-col */}
                                            <div className="w-full h-full flex flex-col [&>*]:flex-1 [&>*]:min-h-0">
                                                {renderComponent(
                                                    comp,
                                                    sourceData,
                                                    index,
                                                    sourceSummary,
                                                    setInteractSource,
                                                    () => handleDeleteWidget(item.id),
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>

                {/* Scraper Status Banner */}
                {(activeScraper || webviewQueue.length > 0) && (
                    <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
                        <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-3 text-sm font-medium">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-200 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                </span>
                                <span>
                                    正在后台抓取网页:{" "}
                                    {sources.find((s) => s.id === activeScraper)
                                        ?.name || "准备中..."}
                                </span>
                                {webviewQueue.length > 0 && (
                                    <span className="text-blue-200 text-xs bg-blue-700/50 px-2 py-0.5 rounded-full ml-1">
                                        剩余 {webviewQueue.length} 个
                                    </span>
                                )}
                            </div>
                            <div className="h-4 w-px bg-blue-400 mx-1"></div>
                            <button
                                onClick={handleShowScraperWindow}
                                className="hover:text-blue-100 transition-colors flex items-center gap-1 text-xs bg-blue-500/50 hover:bg-blue-500/80 px-3 py-1.5 rounded-full"
                            >
                                <ExternalLink className="h-3 w-3" />
                                显示浏览器
                            </button>
                            <button
                                onClick={handleSkipScraper}
                                className="hover:text-blue-100 transition-colors flex items-center gap-1 text-xs bg-blue-500/50 hover:bg-blue-500/80 px-3 py-1.5 rounded-full"
                            >
                                跳过当前
                            </button>
                            <button
                                onClick={handleClearScraperQueue}
                                className="text-red-100 hover:text-white transition-colors flex items-center gap-1 text-xs bg-red-500/60 hover:bg-red-500/90 px-3 py-1.5 rounded-full"
                            >
                                清空队列
                            </button>
                        </div>
                    </div>
                )}
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
                onPushToQueue={handlePushToQueue}
            />
        </TooltipProvider>
    );
}

function App() {
    return (
        <BrowserRouter>
            <div className="flex h-screen flex-col bg-background text-foreground">
                <TopNav />
                <div className="flex-1 overflow-hidden relative">
                    <Routes>
                        <Route
                            path="/oauth/callback"
                            element={<OAuthCallback />}
                        />
                        <Route
                            path="/integrations"
                            element={<IntegrationsPage />}
                        />
                        <Route path="/" element={<Dashboard />} />
                    </Routes>
                </div>
            </div>
        </BrowserRouter>
    );
}

export default App;
