"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useCognos } from "@/lib/cognos-context";
import type { Insight } from "@/types/cognos";

export default function InsightsPage() {
  const { activeWorkspace } = useCognos();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/insights?workspaceId=${activeWorkspace.id}`);
      const data = (await res.json()) as Insight[];
      setInsights(data);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    await fetch("/api/insights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isRead: true }),
    });
    setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, isRead: true } : i)));
  };

  const remove = async (id: string) => {
    await fetch(`/api/insights?id=${id}`, { method: "DELETE" });
    setInsights((prev) => prev.filter((i) => i.id !== id));
    setConfirmId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Insights"
        subtitle="Autonomous council deliberations and daily briefings"
        actions={
          <a
            href="/agent"
            className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ background: "#4f7aff", color: "white" }}
          >
            Run deliberation
          </a>
        }
      />
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: "#475569" }}>
            Loading…
          </div>
        ) : insights.length === 0 ? (
          <div className="text-center py-16" style={{ color: "#475569" }}>
            <div className="text-3xl mb-2">✦</div>
            <div className="text-sm">No insights yet</div>
            <div className="text-xs mt-1">Run a deliberation in the Agent module</div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {insights.map((item) => (
              <div
                key={item.id}
                className="rounded-xl p-5"
                style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: "#c7d2fe" }}>
                      {item.title}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "#475569" }}>
                      {item.triggerType} · {item.taskType || "analysis"}
                      {item.modelUsed ? ` · ${item.modelUsed}` : ""}
                    </div>
                    <div className="text-sm mt-3 whitespace-pre-wrap leading-relaxed" style={{ color: "#94a3b8" }}>
                      {item.content}
                    </div>
                  </div>
                  {!item.isRead && (
                    <span
                      className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "#4f7aff18", color: "#4f7aff" }}
                    >
                      new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => markRead(item.id)}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ color: item.isRead ? "#334155" : "#4f7aff" }}
                  >
                    {item.isRead ? "Read" : "Mark read"}
                  </button>
                  {confirmId === item.id ? (
                    <>
                      <button onClick={() => remove(item.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "#7f1d1d", color: "#fecaca" }}>
                        Confirm delete
                      </button>
                      <button onClick={() => setConfirmId(null)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#64748b" }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmId(item.id)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#64748b" }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
