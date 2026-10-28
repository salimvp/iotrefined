"use client";

import { useId } from "react";

/**
 * A lightweight SVG sparkline. No chart library needed — keeps the bundle small
 * and the code easy to follow.
 */
export function Sparkline({
  values,
  min,
  max,
  stroke = "#818cf8",
  height = 44,
  fill = true,
}: {
  values: number[];
  min?: number;
  max?: number;
  stroke?: string;
  height?: number;
  fill?: boolean;
}) {
  const gid = useId().replace(/:/g, "");
  const data = values.length > 1 ? values : [0, 0];
  const lo = min ?? Math.min(...data);
  const hi = max ?? Math.max(...data);
  const span = hi - lo || 1;
  const W = 100;
  const H = 100;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - lo) / span) * H;
    return [x, Math.max(2, Math.min(H - 2, y))] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} ${W},${H} 0,${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill ? <polygon points={area} fill={`url(#g-${gid})`} /> : null}
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
