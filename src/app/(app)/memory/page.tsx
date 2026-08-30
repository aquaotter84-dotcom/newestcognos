"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useCognos } from "@/lib/cognos-context";
import type { Memory } from "@/types/cognos";
import { EVIDENCE_META, TIER_META, VOLATILITY_META } from "@/types/cognos";

type FormState = {
  key: string;
  value: string;
  tier: Memory["tier"];
  memoryType: Memory["memoryType"];
  importance: number;
  evidenceLevel: Memory["evidenceLevel"];
  volatility: Memory["volatility"];
};

const emptyForm: FormState = {
  key: "",
  value: "",
  tier: "medium",
  memoryType: "semantic",
  importance: 5,
  evidenceLevel: "inferred",
  volatility: "medium",
};

export default function MemoryPage() {
  const { activeWorkspace } = useCognos();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/memories?workspaceId=${activeWorkspace.id}`);
      const data = (await res.json()) as Memory[];
      setMemories(data);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = memories.filter(
    (m) =>
      m.key.toLowerCase().includes(search.toLowerCase()) ||
      m.value.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!form.key.trim() || !form.value.trim()) return;
    setError(null);
    const res = await fetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, workspaceId: activeWorkspace?.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save memory");
      return;
    }
    setForm(emptyForm);
    setAdding(false);
    await load();
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const mem = memories.find((m) => m.id === editingId);
    if (!mem) return;
    const res = await fetch("/api/memories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId,
        key: mem.key,
        value: mem.value,
        tier: mem.tier,
        memoryType: mem.memoryType,
        importance: mem.importance,
        evidenceLevel: mem.evidenceLevel,
        volatility: mem.volatility,
        isEnabled: mem.isEnabled,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      await load();
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/memories?id=${id}`, { method: "DELETE" });
    setConfirmId(null);
    await load();
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Continuity Memory"
        subtitle={`${memories.length} stored in ${activeWorkspace?.name || "this workspace"}`}
        actions={
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memory…"
              className="text-sm px-3 py-1.5 rounded-lg outline-none w-44"
              style={{
                background: "#0c0f1e",
                border: "1px solid #1a1f3a",
                color: "#e2e8f0",
              }}
            />
            <button
              onClick={() => {
                setAdding((v) => !v);
                setEditingId(null);
              }}
              className="text-sm px-3 py-1.5 rounded-lg font-medium"
              style={{ background: "#4f7aff", color: "white" }}
            >
              + Add
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div
            className="text-sm px-4 py-2 rounded-xl"
            style={{ background: "#1a0505", border: "1px solid #7f1d1d44", color: "#fca5a5" }}
          >
            {error}
          </div>
        )}

        {adding && (
          <div
            className="max-w-3xl mx-auto rounded-2xl p-4 space-y-3"
            style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Key (e.g. preferred_style)"
                value={form.key}
                onChange={(e) => setField("key", e.target.value)}
                className="text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
              />
              <select
                value={form.tier}
                onChange={(e) => setField("tier", e.target.value as FormState["tier"])}
                className="text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
              >
                {(["short", "medium", "long", "mythic"] as const).map((t) => (
                  <option key={t} value={t}>{TIER_META[t].label}</option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Value — the fact, preference, or important detail"
              value={form.value}
              onChange={(e) => setField("value", e.target.value)}
              rows={3}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
              style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <select
                value={form.memoryType}
                onChange={(e) => setField("memoryType", e.target.value as FormState["memoryType"])}
                className="text-sm px-2 py-2 rounded-lg outline-none"
                style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
              >
                <option value="working">Working</option>
                <option value="episodic">Episodic</option>
                <option value="semantic">Semantic</option>
              </select>
              <input
                type="number"
                min={1}
                max={10}
                value={form.importance}
                onChange={(e) => setField("importance", Number(e.target.value))}
                className="text-sm px-2 py-2 rounded-lg outline-none"
                style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
              />
              <select
                value={form.evidenceLevel}
                onChange={(e) => setField("evidenceLevel", e.target.value as FormState["evidenceLevel"])}
                className="text-sm px-2 py-2 rounded-lg outline-none"
                style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
              >
                {(["direct", "repeated", "inferred", "assumed"] as const).map((e) => (
                  <option key={e} value={e}>{EVIDENCE_META[e].label}</option>
                ))}
              </select>
              <select
                value={form.volatility}
                onChange={(e) => setField("volatility", e.target.value as FormState["volatility"])}
                className="text-sm px-2 py-2 rounded-lg outline-none"
                style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
              >
                {(["low", "medium", "high"] as const).map((v) => (
                  <option key={v} value={v}>{VOLATILITY_META[v].label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="text-sm px-4 py-2 rounded-lg font-medium flex-1"
                style={{ background: "#4f7aff", color: "white" }}
              >
                Store Memory
              </button>
              <button
                onClick={() => setAdding(false)}
                className="text-sm px-4 py-2 rounded-lg"
                style={{ background: "#1a1f3a", color: "#64748b" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: "#475569" }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: "#475569" }}>
            <div className="text-3xl mb-2">⬡</div>
            <div className="text-sm">No memories stored</div>
            <div className="text-xs mt-1">COGNOS will learn as you converse</div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {filtered.map((mem) => (
              <div
                key={mem.id}
                className="rounded-xl p-4"
                style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}
              >
                {editingId === mem.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={mem.key}
                        onChange={(e) => setMemories((prev) => prev.map((m) => m.id === mem.id ? { ...m, key: e.target.value } : m))}
                        className="text-sm px-3 py-2 rounded-lg outline-none"
                        style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
                      />
                      <select
                        value={mem.tier}
                        onChange={(e) => setMemories((prev) => prev.map((m) => m.id === mem.id ? { ...m, tier: e.target.value as Memory["tier"] } : m))}
                        className="text-sm px-2 py-2 rounded-lg outline-none"
                        style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
                      >
                        {(["short", "medium", "long", "mythic"] as const).map((t) => (
                          <option key={t} value={t}>{TIER_META[t].label}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={mem.value}
                      onChange={(e) => setMemories((prev) => prev.map((m) => m.id === mem.id ? { ...m, value: e.target.value } : m))}
                      rows={2}
                      className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
                      style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="text-sm px-4 py-2 rounded-lg font-medium" style={{ background: "#4f7aff", color: "white" }}>
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-sm px-4 py-2 rounded-lg" style={{ background: "#1a1f3a", color: "#64748b" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 text-xs px-2 py-1 rounded-full capitalize"
                      style={{
                        background: `${TIER_META[mem.tier].color}18`,
                        color: TIER_META[mem.tier].color,
                        border: `1px solid ${TIER_META[mem.tier].color}33`,
                      }}
                    >
                      {mem.tier}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono" style={{ color: "#64748b" }}>{mem.key}</span>
                        <span className="text-xs px-1.5 rounded" style={{ background: "#1a1f3a", color: "#475569" }}>
                          {mem.memoryType}
                        </span>
                        <span className="text-xs px-1.5 rounded" style={{ background: "#1a1f3a", color: "#475569" }}>
                          {EVIDENCE_META[mem.evidenceLevel].label}
                        </span>
                        <span className="text-xs px-1.5 rounded" style={{ background: "#1a1f3a", color: "#475569" }}>
                          {VOLATILITY_META[mem.volatility].label}
                        </span>
                        <span className="text-xs px-1.5 rounded" style={{ background: "#1a1f3a", color: "#475569" }}>
                          {mem.importance}/10
                        </span>
                        {!mem.isEnabled && (
                          <span className="text-xs px-1.5 rounded" style={{ background: "#1a1f3a", color: "#f59e0b" }}>
                            disabled
                          </span>
                        )}
                      </div>
                      <div className="text-sm" style={{ color: "#c7d2fe" }}>{mem.value}</div>
                      {mem.sessionId && (
                        <div className="text-xs mt-1" style={{ color: "#334155" }}>
                          Source: {mem.sessionId.slice(0, 8)}
                        </div>
                      )}
                    </div>

                    {confirmId !== mem.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingId(mem.id)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#64748b" }} title="Edit">✎</button>
                        <button onClick={() => { setEditingId(null); setMemories((prev) => prev.map((m) => m.id === mem.id ? { ...m, isEnabled: !m.isEnabled } : m)); fetch("/api/memories", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: mem.id, isEnabled: !mem.isEnabled }) }).catch(() => {}); }} className="text-xs px-2 py-1 rounded-lg" style={{ color: mem.isEnabled ? "#64748b" : "#f59e0b" }} title="Toggle enabled">
                          {mem.isEnabled ? "·" : "✓"}
                        </button>
                        <button onClick={() => setConfirmId(mem.id)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#64748b" }} title="Delete">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: "#f59e0b" }}>Delete?</span>
                        <button onClick={() => handleDelete(mem.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "#7f1d1d", color: "#fecaca" }}>Yes</button>
                        <button onClick={() => setConfirmId(null)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "#1a1f3a", color: "#64748b" }}>No</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
