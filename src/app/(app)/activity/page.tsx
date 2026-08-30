"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useCognos } from "@/lib/cognos-context";
import type { ActivityEvent } from "@/types/cognos";

const TYPE_COLORS: Record<string, string> = {
  agent_invocation: "#4f7aff",
  model_call: "#a78bfa",
  memory_operation: "#34d399",
  tool_call: "#f59e0b",
  error: "#f43f5e",
};

export default function ActivityPage() {
  const { activeWorkspace } = useCognos();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    setLoading(true);
    fetch(`/api/activity?workspaceId=${activeWorkspace.id}`)
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [activeWorkspace]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Activity"
        subtitle="Audit trail of council invocations and operations"
      />
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: "#475569" }}>
            Loading…
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: "#475569" }}>
            No activity yet. Send a message to start the council.
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {events.map((e) => {
              const color = TYPE_COLORS[e.eventType] || "#64748b";
              return (
                <div
                  key={e.id}
                  className="rounded-xl p-4 flex items-start gap-3"
                  style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}
                  >
                    ↯
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ color: "#c7d2fe" }}>
                      {e.description || e.eventType}
                    </div>
                    <div className="text-xs mt-1 flex items-center gap-3 flex-wrap" style={{ color: "#475569" }}>
                      <span>{e.eventType}</span>
                      {e.taskType && <span>task: {e.taskType}</span>}
                      {e.modelUsed && <span>model: {e.modelUsed}</span>}
                      {e.latencyMs > 0 && <span>{e.latencyMs} ms</span>}
                      {e.errorMessage && <span style={{ color: "#f43f5e" }}>{e.errorMessage}</span>}
                    </div>
                  </div>
                  <div className="text-xs flex-shrink-0" style={{ color: "#334155" }}>
                    {new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
