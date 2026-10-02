"use client";

import { useEffect, useRef, useState } from "react";

import { formatGold } from "@/lib/api";

const HEIGHT = 260;
const MARGIN = { top: 24, right: 12, bottom: 28, left: 56 };

export type ChartSeries = { key: string; label: string; color: string };

export type ChartWeek = {
  week: string;
  values: Record<string, number>;
  /** Extra tooltip lines, e.g. a breakdown of a single shown series. */
  details?: [string, number][];
};

function niceMax(value: number) {
  if (value <= 0) return 1000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value / 4)! * magnitude;
  return Math.ceil(value / step) * step;
}

/** A rect whose top corners are rounded: the data end of a column. */
function topRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

function weekLabel(week: string) {
  return new Date(`${week}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Weekly stacked columns. Callers pass series in a fixed order with fixed
 * colors; filtering hides series but never recolors the ones that remain.
 */
export default function StackedWeeklyChart({
  weeks,
  series,
  label,
}: {
  weeks: ChartWeek[];
  series: ChartSeries[];
  label: string;
}) {
  const valueOf = (week: ChartWeek, key: string) => week.values[key] ?? 0;
  const totalOf = (week: ChartWeek) => series.reduce((sum, s) => sum + valueOf(week, s.key), 0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxValue = niceMax(Math.max(0, ...weeks.map(totalOf)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxValue);
  const band = weeks.length ? plotWidth / weeks.length : 0;
  const barWidth = Math.min(48, band * 0.6);
  const y = (value: number) => MARGIN.top + plotHeight - (value / maxValue) * plotHeight;
  // Skip x labels when they'd collide.
  const labelEvery = Math.ceil(52 / Math.max(band, 1));
  const lastIndex = weeks.length - 1;
  const hoveredWeek = hovered === null ? null : weeks[hovered];

  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div ref={containerRef} className="relative" onMouseLeave={() => setHovered(null)}>
        <svg width={width} height={HEIGHT} role="img" aria-label={`${label}: ${series.map((s) => s.label).join(", ")}`}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--border)"
                strokeDasharray={tick === 0 ? undefined : "2 4"}
              />
              <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
                {formatGold(tick)}
              </text>
            </g>
          ))}

          {weeks.map((week, index) => {
            const x = MARGIN.left + band * index + (band - barWidth) / 2;
            const total = totalOf(week);
            const dimmed = hovered !== null && hovered !== index;
            const segments = series.filter((s) => valueOf(week, s.key) > 0);
            let base = 0;

            return (
              <g key={week.week} opacity={dimmed ? 0.45 : 1}>
                {segments.map((s, i) => {
                  const bottom = y(base);
                  base += valueOf(week, s.key);
                  const top = y(base);
                  const isTop = i === segments.length - 1;
                  // 2px surface gap above every segment that has another stacked on it.
                  const height = Math.max(0, bottom - top - (i > 0 ? 2 : 0));
                  return isTop ? (
                    <path key={s.key} d={topRoundedRect(x, top, barWidth, height, 4)} fill={s.color} />
                  ) : (
                    <rect key={s.key} x={x} y={top} width={barWidth} height={height} fill={s.color} />
                  );
                })}
                {index === lastIndex && total > 0 && (
                  <text x={x + barWidth / 2} y={y(total) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--foreground)">
                    {formatGold(total)}
                  </text>
                )}
                {(lastIndex - index) % labelEvery === 0 && (
                  <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                    {weekLabel(week.week)}
                  </text>
                )}
                {/* Full-height hit target, wider than the column. */}
                <rect
                  x={MARGIN.left + band * index}
                  y={MARGIN.top}
                  width={band}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                />
              </g>
            );
          })}
        </svg>

        {hoveredWeek && hovered !== null && (
          <div
            className="pointer-events-none absolute z-10 min-w-40 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg"
            style={{
              left: Math.min(MARGIN.left + band * (hovered + 0.5) + 12, width - 170),
              top: MARGIN.top,
            }}
          >
            <div className="mb-1 font-medium">Week of {weekLabel(hoveredWeek.week)}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tabular-nums">{formatGold(valueOf(hoveredWeek, s.key))}</span>
              </div>
            ))}
            {hoveredWeek.details?.map(([name, amount]) => (
              <div key={name} className="flex justify-between gap-4 pl-3.5 text-muted">
                <span>{name}</span>
                <span className="tabular-nums">{formatGold(amount)}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between gap-4 border-t border-border pt-1 font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatGold(totalOf(hoveredWeek))}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
