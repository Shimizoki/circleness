import type { DrawingInput } from './types';

export const CHART_HEIGHT = 120;
export const CHART_PAD = 16;

export type ChartSurface = {
  ctx: CanvasRenderingContext2D;
  panelW: number;
  panelH: number;
};

/** Shared bottom panel chrome + title. Returns the drawable plot rect. */
export function beginChartPanel(
  surface: ChartSurface,
  title: string,
): { left: number; right: number; top: number; bottom: number; chartTop: number } {
  const { ctx, panelW, panelH } = surface;
  const chartTop = panelH - CHART_HEIGHT;
  const left = CHART_PAD;
  const right = panelW - CHART_PAD;
  const top = chartTop + 28;
  const bottom = panelH - CHART_PAD;

  ctx.fillStyle = 'rgba(247, 244, 237, 0.92)';
  ctx.fillRect(0, chartTop, panelW, CHART_HEIGHT);
  ctx.strokeStyle = 'rgba(26, 26, 24, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, chartTop + 0.5);
  ctx.lineTo(panelW, chartTop + 0.5);
  ctx.stroke();

  ctx.fillStyle = 'rgba(26, 26, 24, 0.55)';
  ctx.font = '12px "Source Sans 3", sans-serif';
  ctx.fillText(title, left, chartTop + 18);

  return { left, right, top, bottom, chartTop };
}

/** Residual line chart: y = value − mean, flat zero = perfect. */
export function drawResidualLineChart(
  surface: ChartSurface,
  title: string,
  residuals: number[],
  meanAbsForScale: number,
): void {
  if (residuals.length < 2) return;
  const { ctx } = surface;
  const { left, right, top, bottom } = beginChartPanel(surface, title);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  let peak = 0;
  for (const r of residuals) peak = Math.max(peak, Math.abs(r));
  const maxAbs = Math.max(peak, Math.abs(meanAbsForScale) * 0.08, 1e-4);

  const yAt = (v: number) => top + height / 2 - (v / maxAbs) * (height / 2 - 4);
  const xAt = (i: number) => left + (i / (residuals.length - 1)) * width;

  ctx.strokeStyle = 'rgba(26, 26, 24, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(left, yAt(0));
  ctx.lineTo(right, yAt(0));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(47, 93, 80, 0.95)';
  ctx.lineWidth = 1.75;
  ctx.lineJoin = 'round';
  residuals.forEach((r, i) => {
    const x = xAt(i);
    const y = yAt(r);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

export type PieSlice = {
  label: string;
  value: number;
  color: string;
};

/** Area comparison as a donut / pie with a legend. */
export function drawAreaPieChart(
  surface: ChartSurface,
  title: string,
  slices: PieSlice[],
): void {
  const positive = slices.filter((s) => s.value > 0);
  if (positive.length === 0) return;

  const { ctx, panelW } = surface;
  const { left, top, bottom, chartTop } = beginChartPanel(surface, title);
  const height = Math.max(1, bottom - top);
  const cx = left + height / 2 + 8;
  const cy = top + height / 2;
  const radius = Math.min(height / 2 - 4, 40);

  const total = positive.reduce((sum, s) => sum + s.value, 0);
  if (total < 1e-9) return;

  let angle = -Math.PI / 2;
  for (const slice of positive) {
    const sweep = (slice.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.fillStyle = slice.color;
    ctx.arc(cx, cy, radius, angle, angle + sweep);
    ctx.closePath();
    ctx.fill();
    angle += sweep;
  }

  // Inner hole → donut
  ctx.beginPath();
  ctx.fillStyle = 'rgba(247, 244, 237, 0.97)';
  ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Legend
  const legendX = cx + radius + 20;
  let legendY = top + 6;
  ctx.font = '12px "Source Sans 3", sans-serif';
  for (const slice of positive) {
    const pct = ((slice.value / total) * 100).toFixed(0);
    ctx.fillStyle = slice.color;
    ctx.fillRect(legendX, legendY, 10, 10);
    ctx.fillStyle = 'rgba(26, 26, 24, 0.7)';
    ctx.fillText(`${slice.label}  ${pct}%`, legendX + 16, legendY + 10);
    legendY += 18;
  }

  void panelW;
  void chartTop;
}

export type BarItem = {
  label: string;
  value: number;
  color: string;
};

/**
 * Side-by-side absolute magnitude bars (same scale).
 * Better than a pie when the grade is a *ratio* (or ratio²) of two lengths.
 */
export function drawComparisonBars(
  surface: ChartSurface,
  title: string,
  bars: BarItem[],
  footer?: string,
): void {
  if (bars.length === 0) return;
  const { ctx } = surface;
  const { left, right, top, bottom } = beginChartPanel(surface, title);
  const width = Math.max(1, right - left);
  const maxVal = Math.max(...bars.map((b) => b.value), 1e-9);
  const rowH = 22;
  const gap = 8;
  const labelW = 118;
  const barLeft = left + labelW;
  const barMaxW = Math.max(1, width - labelW - 52);

  ctx.font = '12px "Source Sans 3", sans-serif';
  bars.forEach((bar, i) => {
    const y = top + i * (rowH + gap);
    ctx.fillStyle = 'rgba(26, 26, 24, 0.7)';
    ctx.fillText(bar.label, left, y + 14);

    const w = (bar.value / maxVal) * barMaxW;
    ctx.fillStyle = 'rgba(26, 26, 24, 0.06)';
    ctx.fillRect(barLeft, y, barMaxW, rowH);
    ctx.fillStyle = bar.color;
    ctx.fillRect(barLeft, y, w, rowH);

    ctx.fillStyle = 'rgba(26, 26, 24, 0.65)';
    ctx.fillText(bar.value.toFixed(0), barLeft + barMaxW + 8, y + 14);
  });

  if (footer) {
    ctx.fillStyle = 'rgba(26, 26, 24, 0.55)';
    ctx.font = '11px "Source Sans 3", sans-serif';
    ctx.fillText(footer, left, bottom - 2);
  }
}

export type ChartDrawer = (surface: ChartSurface, input: DrawingInput) => void;
