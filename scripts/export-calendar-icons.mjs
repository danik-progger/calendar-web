import { writeFileSync, readFileSync } from "node:fs";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Mail,
  Plus,
  Square,
  UserRound,
} from "@animateicons/vanilla/lucide";

const check = { ...Check.children[0] };
check.animate = { scale: check.animate.scale, transition: check.animate.transition.scale };
const allDayOutline = JSON.parse(
  readFileSync(new URL("../src/components/icons/all-day-outline.json", import.meta.url), "utf8"),
);
const roundedSquare = { ...Square.children[0], attrs: allDayOutline };
const icons = {
  CalendarDays,
  Check: { children: [check] },
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Mail,
  Plus,
  Square: { children: [roundedSquare] },
  UserRound,
};
const frameRate = 120;
const library = new URL("../node_modules/@animateicons/vanilla/", import.meta.url);
const output = new URL("../../shared/icons/", import.meta.url);
const notice =
  readFileSync(new URL("LICENSE", library), "utf8") +
  "\n" +
  readFileSync(new URL("THIRD_PARTY_NOTICES.md", library), "utf8")
    .split("## Hugeicons")[0]
    .trimEnd() +
  "\n";

// Normalize the commands used by these SVGs to move, line, cubic and close.
function pathData({ tag, attrs }) {
  if (tag === "circle") {
    const { cx, cy, r } = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, Number(v)]));
    return svgPath(`M${cx + r} ${cy}a${r} ${r} 0 1 1 ${-2 * r} 0a${r} ${r} 0 1 1 ${2 * r} 0z`);
  }
  if (tag === "rect") {
    const {
      x,
      y,
      width,
      height,
      rx: r,
    } = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, Number(v)]));
    return svgPath(
      `M${x + r} ${y}h${width - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${height - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${2 * r - width}a${r} ${r} 0 0 1 ${-r} ${-r}v${2 * r - height}a${r} ${r} 0 0 1 ${r} ${-r}z`,
    );
  }
  if (tag !== "path") throw Error(`Unsupported SVG tag ${tag}`);
  return svgPath(attrs.d);
}

function svgPath(d) {
  const tokens = d.match(/[a-z]|[+-]?(?:\d*\.\d+|\d+)/gi);
  let x = 0,
    y = 0,
    command;
  const result = [];
  for (let i = 0; i < tokens.length;) {
    if (/[a-z]/i.test(tokens[i])) command = tokens[i++];
    if (!command) throw Error(`Missing SVG command in ${d}`);
    const op = command.toLowerCase();
    const read = () => Number(tokens[i++]);
    const dx = op === command ? x : 0,
      dy = op === command ? y : 0;
    const start = [x, y];
    switch (op) {
      case "m":
      case "l":
        x = dx + read();
        y = dy + read();
        result.push([x, y, op === "m" ? 0 : 1]);
        if (op === "m") command = command === "m" ? "l" : "L";
        break;
      case "h":
        x = dx + read();
        result.push([x, y, 1]);
        break;
      case "v":
        y = dy + read();
        result.push([x, y, 1]);
        break;
      case "a": {
        const rx = read(),
          ry = read(),
          rotation = read(),
          large = read(),
          sweep = read();
        x = dx + read();
        y = dy + read();
        if (rx !== ry || rotation !== 0) throw Error("Only circular SVG arcs are supported");
        result.push(...arc(start, [x, y], rx, large, sweep));
        break;
      }
      case "z":
        result.push([]);
        command = undefined;
        break;
      default:
        throw Error(`Unsupported SVG command ${command}`);
    }
  }
  if (!result.flat().every(Number.isFinite)) throw Error(`Invalid SVG path ${d}`);
  return result;
}

function arc([x0, y0], [x1, y1], radius, large, sweep) {
  const dx = (x1 - x0) / 2,
    dy = (y1 - y0) / 2;
  const half = Math.hypot(dx, dy);
  const r = Math.max(radius, half);
  const offset = (Math.sqrt(Math.max(0, r * r - half * half)) / half) * (large === sweep ? -1 : 1);
  const cx = (x0 + x1) / 2 - dy * offset,
    cy = (y0 + y1) / 2 + dx * offset;
  let start = Math.atan2(y0 - cy, x0 - cx);
  let span = Math.atan2(y1 - cy, x1 - cx) - start;
  if (sweep && span < 0) span += 2 * Math.PI;
  if (!sweep && span > 0) span -= 2 * Math.PI;
  const count = Math.ceil(Math.abs(span) / (Math.PI / 2));
  const delta = span / count;
  const k = (4 / 3) * Math.tan(delta / 4);
  return Array.from({ length: count }, (_, index) => {
    const end = start + delta;
    const ax = Math.cos(start),
      ay = Math.sin(start);
    const bx = Math.cos(end),
      by = Math.sin(end);
    start = end;
    return [
      cx + r * (ax - k * ay),
      cy + r * (ay + k * ax),
      cx + r * (bx + k * by),
      cy + r * (by - k * bx),
      ...(index === count - 1 ? [x1, y1] : [cx + r * bx, cy + r * by]),
    ];
  });
}

function easeInOut(t) {
  const cubic = (s, a, b) => (3 * (1 - s) * ((1 - s) * a + s * b) + s * s) * s;
  let low = 0,
    high = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2;
    if (cubic(mid, 0.42, 0.58) < t) low = mid;
    else high = mid;
  }
  return cubic((low + high) / 2, 0, 1);
}

function sample(values, transition, time) {
  const {
    duration,
    delay = 0,
    times = values.map((_, i) => i / (values.length - 1)),
    ease,
  } = transition;
  if (ease !== "easeInOut") throw Error(`Unsupported easing ${ease}`);
  const t = (time - delay) / duration;
  if (t <= 0) return values[0];
  if (t >= 1) return values.at(-1);
  const end = times.findIndex((v) => t <= v);
  const progress = easeInOut((t - times[end - 1]) / (times[end] - times[end - 1]));
  return values[end - 1] + (values[end] - values[end - 1]) * progress;
}

function layer(node) {
  const paths = node.tag === "g" ? node.children.map(pathData) : [pathData(node)];
  const frames = [];
  if (node.animate) {
    const { transition, ...tracks } = node.animate;
    for (const key of Object.keys(tracks)) {
      if (!["x", "y", "scale", "scaleY", "rotate"].includes(key))
        throw Error(`Unsupported track ${key}`);
    }
    const ox = parseFloat(node.style?.originX ?? 0),
      oy = parseFloat(node.style?.originY ?? 0);
    const count = Math.round((transition.duration + (transition.delay ?? 0)) * frameRate);
    for (let i = 0; i <= count; i++) {
      const value = (key, fallback) =>
        tracks[key] ? sample(tracks[key], transition, i / frameRate) : fallback;
      const scale = value("scale", 1),
        sy = value("scaleY", scale);
      const angle = (value("rotate", 0) * Math.PI) / 180;
      const a = Math.cos(angle) * scale,
        b = Math.sin(angle) * scale;
      const c = -Math.sin(angle) * sy,
        d = Math.cos(angle) * sy;
      frames.push([
        a,
        b,
        c,
        d,
        ox - a * ox - c * oy + value("x", 0),
        oy - b * ox - d * oy + value("y", 0),
      ]);
    }
  }
  return { paths, frames };
}

const data = Object.fromEntries(
  Object.entries(icons).map(([name, icon]) => [name, icon.children.map(layer)]),
);
// Keep the sampled affine transforms small enough to bundle in all native apps.
const tidy = (_, value) =>
  typeof value === "number" ? Math.round(value * 100000) / 100000 : value;
writeFileSync(
  new URL("calendar-icons.json", output),
  JSON.stringify(
    {
      source: "@animateicons/vanilla/lucide",
      frameRate,
      icons: data,
    },
    tidy,
  ) + "\n",
);
writeFileSync(new URL("LICENSE.txt", output), notice);
