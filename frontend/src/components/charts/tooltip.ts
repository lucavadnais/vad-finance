import type { ChartConfig } from '@/components/ui/chart';
import { h, render } from 'vue';
import ChartTooltipBody from './ChartTooltipBody.vue';

type TooltipOptions = { hideZero?: boolean; showTotal?: boolean; dateLabel?: boolean };

// Unovis tooltips take an HTML string. Unlike shadcn's componentToString, this
// reads the config on every hover (series change once data has loaded) and
// renders through Vue, so category names are escaped.
export function tooltipTemplate(getConfig: () => ChartConfig, options: TooltipOptions = {}) {
  return (d: Record<string, unknown>) => {
    // Stacked bars hand over a { datum, stackIndex, ... } wrapper, lines the row itself
    const payload = (d.datum ?? d) as Record<string, unknown>;
    const div = document.createElement('div');
    render(h(ChartTooltipBody, { ...options, payload, config: getConfig() }), div);
    const html = div.innerHTML;
    render(null, div);
    return html;
  };
}
