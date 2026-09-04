"use client";

import { OPERATOR_META, OPERATOR_ORDER } from "@/types";

/**
 * Shown while the council deliberates. The highlight walks the council in
 * order as a hint of the pipeline — the request itself is a single
 * non-streaming deliberation, so this is an ambient "thinking" state, not a
 * progress bar.
 */
export default function ThinkingIndicator({ stage = 0 }: { stage?: number }) {
  const active = OPERATOR_ORDER[Math.min(stage, OPERATOR_ORDER.length - 1)];
  const activeMeta = OPERATOR_META[active];

  return (
    <div className="flex gap-3 animate-slide-up">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold council-active"
        style={{
          background: "var(--cognos-surface)",
          border: "1px solid #4f7aff44",
          color: "var(--cognos-accent)",
        }}
      >
        C
      </div>

      <div
        className="rounded-2xl rounded-tl-sm px-4 py-3"
        style={{ background: "var(--cognos-surface)", border: "1px solid var(--cognos-border)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium" style={{ color: "var(--cognos-muted)" }}>
            The council is deliberating
          </span>
          <span
            className="text-xs font-semibold"
            style={{ color: activeMeta.color }}
          >
            — {activeMeta.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {OPERATOR_ORDER.map((op, i) => {
            const m = OPERATOR_META[op];
            const done = i < stage;
            const current = i === Math.min(stage, OPERATOR_ORDER.length - 1);
            return (
              <span
                key={op}
                className={`flex items-center justify-center rounded-md ${current ? "council-active" : ""}`}
                style={{
                  width: 26,
                  height: 22,
                  fontSize: 12,
                  color: done || current ? m.color : "var(--cognos-faint)",
                  background: current ? `${m.color}18` : "var(--cognos-surface-2)",
                  border: `1px solid ${done || current ? `${m.color}55` : "var(--cognos-border)"}`,
                  opacity: done || current ? 1 : 0.6,
                }}
                title={m.label}
              >
                {m.icon}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
