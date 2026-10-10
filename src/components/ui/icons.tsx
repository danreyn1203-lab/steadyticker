import type { SVGProps } from "react";

/**
 * Small inline icon set. Inlined (no icon dependency) per the plan's guidance
 * to avoid unnecessary libraries. All inherit `currentColor`.
 */

type P = SVGProps<SVGSVGElement>;

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ArrowUp(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M8 13V3M8 3l-4 4M8 3l4 4" />
    </svg>
  );
}

export function ArrowDown(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M8 3v10M8 13l-4-4M8 13l4-4" />
    </svg>
  );
}

export function ArrowRight(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M3 8h10M13 8l-4-4M13 8l-4 4" />
    </svg>
  );
}

export function Search(p: P) {
  return (
    <svg {...base} {...p}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M13.5 13.5 10.2 10.2" />
    </svg>
  );
}

export function Check(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

export function Info(p: P) {
  return (
    <svg {...base} {...p}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.4v3.4M8 5.2h.01" />
    </svg>
  );
}

export function External(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M9.5 3H13v3.5M13 3l-6 6M11 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2.5" />
    </svg>
  );
}

export function Bookmark(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M4 3h8v10l-4-2.6L4 13V3Z" />
    </svg>
  );
}

export function Menu(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    </svg>
  );
}

export function Close(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function ChevronDown(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function Dot(p: P) {
  return (
    <svg {...base} {...p} fill="currentColor" stroke="none">
      <circle cx="8" cy="8" r="3" />
    </svg>
  );
}

export function Pencil(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M11 2.5l2.5 2.5-8 8-3 .5.5-3 8-8z" />
    </svg>
  );
}
