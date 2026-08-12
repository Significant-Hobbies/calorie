// Shared helpers for the hand-built SVG charts. No external chart dependency —
// these keep the visual language consistent with the existing CSS bar chart and
// use the project's design tokens via CSS custom properties.

export type Point = { x: number; y: number };

/** Build an SVG path string for a smooth line through the given points. */
export function linePath(points: Point[]): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    path += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return path;
}

/** Build a closed area path (line + baseline) for filling under a line. */
export function areaPath(points: Point[], baseline: number): string {
  if (!points.length) return '';
  const top = linePath(points);
  return `${top} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
}

/** Linear scale from a data domain to a pixel range. */
export function scale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Nice rounded max for a chart axis given a raw maximum. */
export function niceMax(value: number, step = 50): number {
  if (value <= 0) return step;
  return Math.ceil(value / step) * step;
}

/** Evenly spaced x positions for N points across a width with padding. */
export function xPositions(count: number, width: number, pad: number): number[] {
  if (count <= 1) return [width / 2];
  const usable = width - pad * 2;
  const step = usable / (count - 1);
  return Array.from({ length: count }, (_, i) => pad + step * i);
}

export type SeriesKey = 'calories' | 'protein' | 'carbs' | 'fibre' | 'water';
