"use client";

import { useState } from "react";
import {
  OPERATOR_META,
  OPERATOR_ORDER,
  type CouncilTrace as CouncilTraceType,
  type OperatorKey,
} from "@/types";

/**
 * The visible deliberation: what each operator contributed, in order,
 * with the Governor's verdict (approval or veto) at the end.
 */
export default function CouncilTrace({ trace }: { trace: CouncilTraceType }) {
  const [activeTab, setActiveTab] = useState<OperatorKey>("observer");

  const activeData =
    trace[activeTab] ?? { note: "This operator was skipped for this task." };
  const latent = trace.latent;
  const vetoed = latent?.governorVetoed === true;
  const meta = OPERATOR_META[activeTab];

  return (
    <div
      className="mt-2 rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--cognos-border)", background: "var(--cognos-surface-2)" }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--cognos-border)" }}
      >
        <span className="text-[11px] font-mono tracking-wider" style={{ color: "var(--cognos-accent)" }}>
          COUNCIL TRACE
        </span>
        <span className="text-[11px]" style={{ color: "var(--cognos-faint)" }}>
          — the deliberation
        </span>
        {vetoed && (
          <span
            className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "#f59e0b1a", color: "var(--cognos-critic)", border: "1px solid #f59e0b44" }}
          >
            ◆ GOVERNOR VETO
          </span>
        )}
      </div>

      {/* Operator tabs */}
      <div className="flex overflow-x-auto" style={{ borderBottom: "1px solid var(--cognos-border)" }}>
        {OPERATOR_ORDER.map((op) => {
          const m = OPERATOR_META[op];
          const isActive = activeTab === op;
          return (
            <button
              key={op}
              onClick={() => setActiveTab(op)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors flex-1 justify-center flex-shrink-0"
              style={{
                color: isActive ? m.color : "var(--cognos-muted)",
                background: isActive ? `${m.color}12` : "transparent",
                borderBottom: isActive ? `2px solid ${m.color}` : "2px solid transparent",
              }}
            >
              <span>{m.icon}</span>
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active operator */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold" style={{ color: meta.color }}>
            {meta.icon} {meta.label}
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: "var(--cognos-border)", color: "var(--cognos-muted)" }}
          >
            {meta.layer}
          </span>
          <span className="text-[10px] hidden sm:inline" style={{ color: "var(--cognos-faint)" }}>
            {meta.role}
          </span>
        </div>

        <div className="space-y-2">
          {Object.entries(activeData).map(([key, val]) => (
            <div key={key} className="rounded-lg p-2.5" style={{ background: "var(--cognos-surface)" }}>
              <div className="text-[11px] font-mono mb-1 capitalize" style={{ color: "var(--cognos-muted)" }}>
                {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toLowerCase()}
              </div>
              <div className="text-sm" style={{ color: "#c7d2fe" }}>
                {Array.isArray(val) ? (
                  (val as unknown[]).length === 0 ? (
                    <span style={{ color: "var(--cognos-faint)" }}>none</span>
                  ) : (
                    <ul className="space-y-1">
                      {(val as unknown[]).map((item, i) => (
                        <li key={i} className="flex gap-2">
                          <span style={{ color: meta.color }}>›</span>
                          <span>{typeof item === "string" ? item : JSON.stringify(item)}</span>
                        </li>
                      ))}
                    </ul>
                  )
                ) : typeof val === "object" && val !== null ? (
                  <pre
                    className="text-xs overflow-auto font-mono whitespace-pre-wrap"
                    style={{ color: "var(--cognos-strategist)" }}
                  >
                    {JSON.stringify(val, null, 2)}
                  </pre>
                ) : val === null || val === "" ? (
                  <span style={{ color: "var(--cognos-faint)" }}>—</span>
                ) : (
                  <span>{String(val)}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Veto explanation, right where the decision was made */}
        {activeTab === "governor" && vetoed && (
          <div
            className="mt-3 rounded-lg p-3 text-xs"
            style={{ background: "#f59e0b0d", border: "1px solid #f59e0b33", color: "#fcd34d" }}
          >
            The Governor withheld approval, so the council&apos;s draft was not released.
            Under the Sovereign principle — Truth, Evidence, Agency, Dignity —
            COGNOS would rather stay silent than answer falsely. The message shown
            is the Governor&apos;s own directive.
          </div>
        )}

        {/* Latent stats */}
        {latent && (
          <div
            className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono"
            style={{ color: "var(--cognos-faint)" }}
          >
            <span>{latent.modelUsed}</span>
            {typeof latent.latencyMs === "number" && (
              <span>{(latent.latencyMs / 1000).toFixed(1)}s</span>
            )}
            <span>task: {latent.taskType}</span>
            <span>
              path: {latent.adaptive?.path ?? "full"} ({latent.adaptive?.complexity ?? "?"})
            </span>
            {latent.revisionCount ? <span>revisions: {latent.revisionCount}</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}
