"use client";

import { useId } from "react";

const PALETTE: Record<string, [string, string, string]> = {
  Plomero: ["#d5f0ea", "#1f8a72", "#083d34"],
  Electricista: ["#fff3d2", "#e2a21a", "#8a6410"],
  Carpintero: ["#f6e4d4", "#c47a45", "#6b3d1e"],
  Pintor: ["#f8dce8", "#d45d8c", "#7a2d4d"],
  Pintora: ["#f8dce8", "#d45d8c", "#7a2d4d"],
  Técnico: ["#dce8fb", "#3d74c9", "#1d3f78"],
  Jardinería: ["#e3f5d8", "#5ea34a", "#2d5a24"],
  Limpieza: ["#e7f4ff", "#5aa7d6", "#1d5578"],
  Cerrajero: ["#eee7fb", "#7a62c4", "#3d2d78"],
  Albañil: ["#f8e6d8", "#c4784a", "#6e3b22"],
};

export function TradeArt({ trade, className = "" }: { trade: string; className?: string }) {
  const [wash, mid, ink] = PALETTE[trade] ?? ["#e7f3ef", "#0e6b56", "#083d34"];
  const gradientId = useId();
  return (
    <svg viewBox="0 0 320 180" className={className} role="img" aria-label={`Ilustración de ${trade}, ejemplo`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={wash} />
          <stop offset="1" stopColor={mid} />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${gradientId})`} />
      <circle cx="250" cy="36" r="28" fill="white" opacity="0.35" />
      <rect x="28" y="96" width="120" height="64" rx="16" fill="white" opacity="0.9" />
      <rect x="46" y="78" width="18" height="82" rx="8" fill={ink} />
      <rect x="78" y="112" width="52" height="10" rx="5" fill={mid} />
      <rect x="78" y="128" width="36" height="8" rx="4" fill={ink} opacity="0.35" />
      <circle cx="214" cy="118" r="34" fill="white" opacity="0.85" />
      <path d="M200 118h28M214 104v28" stroke={ink} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  const colors = ["#0e6b56", "#1d5578", "#7a2d4d", "#6b3d1e", "#3d2d78", "#2d5a24"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <span className={`grid place-items-center rounded-full font-extrabold text-white ${className}`} style={{ background: color }} aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  );
}
