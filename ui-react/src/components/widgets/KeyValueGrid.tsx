import { KeyValueGridWidget } from "../../types/config";
import { evaluateTemplate } from "../../lib/utils";

interface Props {
    widget: KeyValueGridWidget;
    data: Record<string, any>;
}

export function KeyValueGrid({ widget, data }: Props) {
    if (!widget.items || Object.keys(widget.items).length === 0) {
        return null; // Empty mapping
    }

    const maxCols = Math.min(3, Object.keys(widget.items).length);
    const gridClass =
        maxCols === 1
            ? "grid-cols-1"
            : maxCols === 2
              ? "grid-cols-2"
              : "grid-cols-3";

    return (
        <div
            className={`grid ${gridClass} gap-y-3 gap-x-4 text-sm w-full h-full min-h-0 overflow-auto content-center`}
        >
            {Object.entries(widget.items).map(([label, template], idx) => {
                const valRaw = evaluateTemplate(template, data);
                const value =
                    valRaw !== undefined && valRaw !== null && valRaw !== ""
                        ? String(valRaw)
                        : "--";
                return (
                    <div key={idx} className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground text-xs leading-tight">
                            {label}
                        </span>
                        <span className="font-medium text-sm leading-tight truncate" title={value}>
                            {value}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
