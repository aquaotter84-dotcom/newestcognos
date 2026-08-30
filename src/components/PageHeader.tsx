"use client";

import type { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 flex-shrink-0 lg:pl-16"
      style={{ borderBottom: "1px solid #1a1f3a", background: "#05070f" }}
    >
      <div className="flex-1 min-w-0">
        <h1
          className="text-lg font-semibold truncate"
          style={{ color: "#e2e8f0" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "#475569" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
