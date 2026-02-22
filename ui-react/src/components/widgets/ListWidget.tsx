import { ListWidgetConfig } from "../../types/config";
import { getFieldFromPath } from "../../lib/utils";
import { WidgetRenderer } from "./WidgetRenderer";

interface Props {
    widget: ListWidgetConfig;
    data: Record<string, any>;
}

export function ListWidget({ widget, data }: Props) {
    const rawData = getFieldFromPath(data, widget.data_source);

    if (!rawData || !Array.isArray(rawData)) {
        return null;
    }

    const alias = widget.item_alias || "item";

    let processedArray = [...rawData];

    // Filter
    if (widget.filter) {
        try {
            // A very simple evaluator for basic string expressions like: "item.usage > 0"
            // We just construct a function that returns the evaluated string safely
            // Note: This is simplified. In a real secured env, use a safe expression parser.
            processedArray = processedArray.filter((item, index) => {
                const ctx = {
                    ...data,
                    [alias]: item,
                    [`${alias}_index`]: index,
                };

                // Extremely simple "field operator value" parser
                const match = widget.filter?.match(
                    /^([a-zA-Z0-9_.[\]]+)\s*([><!=]+)\s*(.+)$/,
                );
                if (match) {
                    const [, path, operator, valueStr] = match;
                    const fieldVal = getFieldFromPath(ctx, path);
                    const cmpVal = isNaN(Number(valueStr))
                        ? valueStr.replace(/['"]/g, "")
                        : Number(valueStr);

                    switch (operator) {
                        case ">":
                            return fieldVal > cmpVal;
                        case "<":
                            return fieldVal < cmpVal;
                        case ">=":
                            return fieldVal >= cmpVal;
                        case "<=":
                            return fieldVal <= cmpVal;
                        case "==":
                            return fieldVal == cmpVal;
                        case "!=":
                            return fieldVal != cmpVal;
                        case "===":
                            return fieldVal === cmpVal;
                        case "!==":
                            return fieldVal !== cmpVal;
                        default:
                            return true;
                    }
                }
                return true; // Fallback if expression isn't parsed
            });
        } catch (e) {
            console.warn("Failed to apply filter", e);
        }
    }

    // Sort
    if (widget.sort_by) {
        const orderMult = widget.sort_order === "desc" ? -1 : 1;
        processedArray.sort((a, b) => {
            const ctxA = { ...data, [alias]: a };
            const ctxB = { ...data, [alias]: b };

            const valA = getFieldFromPath(ctxA, widget.sort_by!);
            const valB = getFieldFromPath(ctxB, widget.sort_by!);

            if (valA < valB) return -1 * orderMult;
            if (valA > valB) return 1 * orderMult;
            return 0;
        });
    }

    // Limit
    if (widget.limit && widget.limit > 0) {
        processedArray = processedArray.slice(0, widget.limit);
    }

    const getLayoutClasses = () => {
        switch (widget.layout) {
            case "row":
                return "flex flex-row flex-wrap gap-4";
            case "grid":
                return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
            case "col":
            default:
                return "flex flex-col gap-4";
        }
    };

    return (
        <div className={getLayoutClasses() + " w-full"}>
            {processedArray.map((item, index) => {
                const scopedData = {
                    ...data,
                    [alias]: item,
                    [`${alias}_index`]: index,
                };

                const renders = Array.isArray(widget.render)
                    ? widget.render
                    : [widget.render];

                const isGridItem = !!widget.layout_config?.grid_template_areas;
                const gridAreas = widget.layout_config?.grid_template_areas
                    ?.map((a) => `"${a}"`)
                    .join(" ");
                const gridColumns = widget.layout_config?.grid_template_columns;

                const wrapperStyle: React.CSSProperties = isGridItem
                    ? {
                          display: "grid",
                          gridTemplateAreas: gridAreas,
                          gridTemplateColumns: gridColumns,
                          gap: "0.5rem",
                      }
                    : {};

                return (
                    <div
                        key={index}
                        className={`w-full border border-border/50 rounded-md p-3 bg-secondary/10 ${isGridItem ? "" : "flex flex-col gap-2"}`}
                        style={wrapperStyle}
                    >
                        {renders.map((childWidget, i) => (
                            <div
                                key={i}
                                style={
                                    childWidget.area
                                        ? { gridArea: childWidget.area }
                                        : undefined
                                }
                            >
                                <WidgetRenderer
                                    widget={childWidget}
                                    data={scopedData}
                                />
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
