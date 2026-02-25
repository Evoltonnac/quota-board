import { HeroMetricWidget } from "../../types/config";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { evaluateTemplate } from "../../lib/utils";

interface Props {
  widget: HeroMetricWidget;
  data: Record<string, any>;
}

export function HeroMetric({ widget, data }: Props) {
  const amountRaw = evaluateTemplate(widget.amount, data);
  const amount =
    amountRaw !== undefined && amountRaw !== null && !isNaN(Number(amountRaw))
      ? Number(amountRaw).toFixed(2)
      : "--";

  let deltaDisplay = null;
  if (widget.delta) {
    const deltaRaw = evaluateTemplate(widget.delta, data);
    if (
      deltaRaw !== undefined &&
      deltaRaw !== null &&
      !isNaN(Number(deltaRaw))
    ) {
      const deltaValue = Number(deltaRaw);
      const isPositive = deltaValue > 0;
      const isNegative = deltaValue < 0;
      deltaDisplay = (
        <div
          className={`flex items-center text-xs font-medium ${isPositive ? "text-green-500" : isNegative ? "text-red-500" : "text-muted-foreground"}`}
        >
          {isPositive && <ArrowUpRight className="w-3 h-3 mr-0.5" />}
          {isNegative && <ArrowDownRight className="w-3 h-3 mr-0.5" />}
          {Math.abs(deltaValue).toFixed(2)}
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-1">
        {widget.prefix && (
          <span className="text-xl font-semibold text-muted-foreground">
            {widget.prefix}
          </span>
        )}
        {widget.currency && !widget.prefix && (
          <span className="text-xl font-semibold text-muted-foreground">
            {widget.currency === "USD" ? "$" : widget.currency}
          </span>
        )}
        <span className="text-3xl font-bold tracking-tight">{amount}</span>
      </div>
      {deltaDisplay}
    </div>
  );
}
