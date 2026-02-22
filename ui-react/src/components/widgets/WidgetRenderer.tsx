import { WidgetConfig } from "../../types/config";
import { HeroMetric } from "./HeroMetric";
import { KeyValueGrid } from "./KeyValueGrid";
import { QuotaBar } from "./QuotaBar";
import { ListWidget } from "./ListWidget";

export function WidgetRenderer({
    widget,
    data,
}: {
    widget: WidgetConfig;
    data: Record<string, any>;
}) {
    switch (widget.type) {
        case "list":
            return <ListWidget widget={widget as any} data={data} />;
        case "hero_metric":
            return <HeroMetric widget={widget as any} data={data} />;
        case "key_value_grid":
            return <KeyValueGrid widget={widget as any} data={data} />;
        case "quota_bar":
            return <QuotaBar widget={widget as any} data={data} />;
        default:
            return (
                <div className="text-xs text-red-500 mt-2">
                    Unknown widget type: {(widget as any).type}
                </div>
            );
    }
}
