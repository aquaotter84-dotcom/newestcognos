"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useCognos } from "@/lib/cognos-context";
import type { ActivityEvent } from "@/types/cognos";

const EVENT_LABELS: Record<string, string> = {
  agent_invocation: "Council turn",
  model_call: "Model call",
  memory_operation: "Memory change",
  tool_call: "Tool call",
  error: "Error",
};

export default function DynamicsPage() {
  const { activeWorkspace } = useCognos();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    setLoading(true);
    fetch(`/api/activity?workspaceId=${activeWorkspace.id}`)
      .then((r) => r.json())
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [activeWorkspace]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Dynamics"
        subtitle="Timeline of changes through the cognitive system"
      />
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: "#475569" }}>Loading…</div>
        ) : events.length === 0 ? (
          <div className="text-center py-16" style={{ color: "#475569" }}>
            <div className="text-3xl mb-2">≋</div>
            <div className="text-sm">No dynamics yet</div>
            <div className="text-xs mt-1">This timeline fills as the council runs</div>
          </div>
        ) : (
          <ol className="max-w-3xl mx-auto relative space-y-4">
            <div className="absolute left-[11px] top-0 bottom-0 w-px" style={{ background: "#1a1f3a" }} />
            {events.map((e) => (
              <li key={e.id} className="relative pl-8">
                <span
                  className="absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ background: "#0c0f1e", border: "1px solid #4f7aff44", color: "#4f7aff" }}
                >
                  ●
                </span>
                <div className="rounded-xl p-3" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
                  <div className="text-sm" style={{ color: "#c7d2fe" }}>
                    {EVENT_LABELS[e.eventType] || e.eventType}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#475569" }}>
                    {e.description || "No description"} · {new Date(e.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
