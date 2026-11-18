import { createMemo, createSignal, onCleanup, onMount, splitProps, type JSX } from "solid-js";

type SmoothRectProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  radius?: number;
  smoothness?: number;
  style?: JSX.CSSProperties;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function continuousPath(width: number, height: number, radius: number, smoothness: number): string {
  if (width <= 0 || height <= 0) return "";

  const s = clamp(smoothness, 0, 1);
  const budget = Math.min(width, height) / 2;
  const r = clamp(radius, 0, budget);
  if (r === 0) return `M 0 0 H ${width} V ${height} H 0 Z`;

  let p = Math.min((1 + s) * r, budget);
  const arcMeasure = 90 * (1 - s);
  const arc = Math.sin((arcMeasure * Math.PI) / 360) * r * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const beta = 45 * s;
  const p3ToP4 = r * Math.tan((alpha * Math.PI) / 360);
  const c = p3ToP4 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  let b = ((1 + s) * r - arc - c - d) / 3;
  let a = 2 * b;

  if ((1 + s) * r > budget) {
    const available = budget - d - arc - c;
    const minA = available / 6;
    b = Math.min(b, available - minA);
    a = available - b;
    p = budget;
  }

  const n = (value: number) => Number(value.toFixed(4));

  return [
    `M ${n(width - p)} 0`,
    `c ${n(a)} 0 ${n(a + b)} 0 ${n(a + b + c)} ${n(d)}`,
    `a ${n(r)} ${n(r)} 0 0 1 ${n(arc)} ${n(arc)}`,
    `c ${n(d)} ${n(c)} ${n(d)} ${n(b + c)} ${n(d)} ${n(a + b + c)}`,
    `L ${n(width)} ${n(height - p)}`,
    `c 0 ${n(a)} 0 ${n(a + b)} ${n(-d)} ${n(a + b + c)}`,
    `a ${n(r)} ${n(r)} 0 0 1 ${n(-arc)} ${n(arc)}`,
    `c ${n(-c)} ${n(d)} ${n(-(b + c))} ${n(d)} ${n(-(a + b + c))} ${n(d)}`,
    `L ${n(p)} ${n(height)}`,
    `c ${n(-a)} 0 ${n(-(a + b))} 0 ${n(-(a + b + c))} ${n(-d)}`,
    `a ${n(r)} ${n(r)} 0 0 1 ${n(-arc)} ${n(-arc)}`,
    `c ${n(-d)} ${n(-c)} ${n(-d)} ${n(-(b + c))} ${n(-d)} ${n(-(a + b + c))}`,
    `L 0 ${n(p)}`,
    `c 0 ${n(-a)} 0 ${n(-(a + b))} ${n(d)} ${n(-(a + b + c))}`,
    `a ${n(r)} ${n(r)} 0 0 1 ${n(arc)} ${n(-arc)}`,
    `c ${n(c)} ${n(-d)} ${n(b + c)} ${n(-d)} ${n(a + b + c)} ${n(-d)}`,
    "Z",
  ].join(" ");
}

export function SmoothRect({ ...props }: SmoothRectProps) {
  const [shape, divProps] = splitProps(props, [
    "children",
    "radius",
    "smoothness",
    "class",
    "style",
  ]);
  let element!: HTMLDivElement;
  const [size, setSize] = createSignal({ width: 0, height: 0 });
  const path = createMemo(() =>
    continuousPath(size().width, size().height, shape.radius ?? 32, shape.smoothness ?? 0.6),
  );

  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(element);
    onCleanup(() => observer.disconnect());
  });

  return (
    <div
      {...divProps}
      ref={element}
      class={`smooth-rect ${shape.class ?? ""}`.trim()}
      style={{
        ...shape.style,
        "clip-path": path() ? `path("${path()}")` : undefined,
      }}
    >
      {shape.children}
    </div>
  );
}
