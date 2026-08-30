"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useCognos } from "@/lib/cognos-context";

export default function AgentPage() {
  const { activeWorkspace } = useCognos();
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("balanced");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [traceSummary, setTraceSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!topic.trim() || !activeWorkspace || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setTraceSummary(null);
    try {
      const res = await fetch("/api/insights/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWorkspace.id, topic, style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deliberation failed");
      setResult(data.insight.content);
      const trace = data.trace as Record<string, unknown>;
      setTraceSummary(
        trace?.latent
          ? `model: ${String((trace.latent as Record<string, unknown>).modelUsed)} · task: ${String((trace.latent as Record<string, unknown>).taskType)}`
          : ""
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Autonomous Agent"
        subtitle="Run a one-off council deliberation outside a chat thread"
        actions={
          <Link href="/insights" className="text-sm px-3 py-1.5 rounded-lg" style={{ background: "#1a1f3a", color: "#a78bfa" }}>
            Insights
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What should the council deliberate about today?"
              rows={4}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
              style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
            />
            <div className="flex gap-2">
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
              >
                <option value="balanced">Balanced</option>
                <option value="casual">Casual</option>
                <option value="technical">Technical</option>
                <option value="strategic">Strategic</option>
              </select>
              <button
                onClick={run}
                disabled={!topic.trim() || running}
                className="flex-1 text-sm px-4 py-2 rounded-lg font-medium"
                style={{
                  background: running ? "#1a1f3a" : "linear-gradient(135deg, #4f7aff, #7c3aed)",
                  color: running ? "#64748b" : "white",
                }}
              >
                {running ? "Deliberating…" : "Run deliberation"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "#1a0505", border: "1px solid #7f1d1d44", color: "#fca5a5" }}>
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-2xl p-6" style={{ background: "#0c0f1e", border: "1px solid #4f7aff44" }}>
              <div className="text-xs mb-3 flex items-center gap-2">
                <span style={{ color: "#4f7aff" }}>⬡ COGNOS AUTONOMOUS</span>
                {traceSummary && <span className="text-xs" style={{ color: "#334155" }}>· {traceSummary}</span>}
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#c7d2fe" }}>
                {result}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
