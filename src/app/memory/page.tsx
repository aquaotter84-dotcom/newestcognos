"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  EVIDENCE_META,
  TIER_META,
  VOLATILITY_META,
  type Memory,
} from "@/types";

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: `${color}14`, color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ key: "", value: "", tier: "medium" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/memories", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as Memory[];
        setMemories(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Failed to save memory");
      return;
    }
    setForm({ key: "", value: "", tier: "medium" });
    setAdding(false);
    await load();
  };

  const handleToggle = async (m: Memory) => {
    setMemories((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, isEnabled: !x.isEnabled } : x))
    );
    await fetch(`/api/memories/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !m.isEnabled }),
    }).catch(() => load());
  };

  const handleDelete = async (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/memories/${id}`, { method: "DELETE" }).catch(() => load());
  };

  return (
    <div className="flex flex-col h-dvh" style={{ background: "var(--cognos-bg)" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--cognos-border)", background: "var(--cognos-bg)" }}
      >
        <Link
          href="/"
          className="p-1.5 rounded-lg text-sm flex-shrink-0"
          style={{ color: "var(--cognos-muted)", border: "1px solid var(--cognos-border)", background: "var(--cognos-surface)" }}
          aria-label="Back to chat"
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate" style={{ color: "#e2e8f0" }}>
            ⬡ Long-term memory
          </h1>
          <p className="text-[11px] truncate" style={{ color: "var(--cognos-faint)" }}>
            What the council carries into every conversation
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0"
          style={{
            background: adding ? "var(--cognos-surface)" : "linear-gradient(135deg, #1e3a8a22, #4f7aff22)",
            border: "1px solid #4f7aff33",
            color: adding ? "var(--cognos-muted)" : "#7cb9ff",
          }}
        >
          {adding ? "Cancel" : "+ Add"}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="px-4 py-3 space-y-2 animate-slide-up flex-shrink-0" style={{ borderBottom: "1px solid var(--cognos-border)" }}>
          <input
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            placeholder="Key (short handle, e.g. primary_goal)"
            className="w-full text-sm px-3 py-2 rounded-lg outline-none"
            style={{ background: "var(--cognos-surface)", border: "1px solid var(--cognos-border)", color: "var(--cognos-text)" }}
          />
          <textarea
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            placeholder="The fact or preference, in one sentence"
            rows={2}
            className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
            style={{ background: "var(--cognos-surface)", border: "1px solid var(--cognos-border)", color: "var(--cognos-text)" }}
          />
          <div className="flex items-center gap-2">
            <select
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value })}
              className="text-xs px-2 py-1.5 rounded-lg outline-none"
              style={{ background: "var(--cognos-surface)", border: "1px solid var(--cognos-border)", color: "var(--cognos-strategist)" }}
            >
              <option value="short">Short-term</option>
              <option value="medium">Medium-term</option>
              <option value="long">Long-term</option>
              <option value="mythic">Mythic</option>
            </select>
            <button
              onClick={handleAdd}
              disabled={!form.key.trim() || !form.value.trim()}
              className="text-xs px-4 py-1.5 rounded-lg font-medium disabled:opacity-40"
              style={{ background: "#4f7aff22", border: "1px solid #4f7aff44", color: "#93c5fd" }}
            >
              Save memory
            </button>
          </div>
          {error && (
            <p className="text-xs" style={{ color: "#fca5a5" }}>
              {error}
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="px-4 py-2.5 flex-shrink-0">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search memories…"
          className="w-full text-sm px-3 py-2 rounded-lg outline-none"
          style={{ background: "var(--cognos-surface)", border: "1px solid var(--cognos-border)", color: "var(--cognos-text)" }}
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2">
        {loading ? (
          <div className="text-sm text-center py-10" style={{ color: "var(--cognos-faint)" }}>
            Loading memory…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-center py-10" style={{ color: "var(--cognos-faint)" }}>
            {memories.length === 0
              ? "No memories yet. The council will record durable facts as you talk."
              : "No memories match your search."}
          </div>
        ) : (
          filtered.map((m) => (
            <div
              key={m.id}
              className="rounded-xl p-3 animate-slide-up"
              style={{
                background: m.isEnabled ? "var(--cognos-surface)" : "transparent",
                border: `1px solid ${m.isEnabled ? "var(--cognos-border)" : "var(--cognos-border)"}`,
                opacity: m.isEnabled ? 1 : 0.5,
              }}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm leading-relaxed" style={{ color: "#e2e8f0" }}>
                    {m.value}
                  </div>
                  <div className="text-[11px] font-mono mt-1" style={{ color: "var(--cognos-faint)" }}>
                    {m.key} · importance {m.importance}/10
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge label={TIER_META[m.tier].label} color={TIER_META[m.tier].color} />
                    <Badge label={EVIDENCE_META[m.evidenceLevel].label} color={EVIDENCE_META[m.evidenceLevel].color} />
                    <Badge label={`volatility ${VOLATILITY_META[m.volatility].label.toLowerCase()}`} color={VOLATILITY_META[m.volatility].color} />
                  </div>
                </div>

                <button
                  onClick={() => handleToggle(m)}
                  className="text-[10px] px-2 py-1 rounded-lg flex-shrink-0 font-medium"
                  style={{
                    background: m.isEnabled ? "#34d39914" : "var(--cognos-surface-2)",
                    border: `1px solid ${m.isEnabled ? "#34d39944" : "var(--cognos-border)"}`,
                    color: m.isEnabled ? "var(--cognos-governor)" : "var(--cognos-muted)",
                  }}
                  title={m.isEnabled ? "Disable — excluded from council context" : "Re-enable"}
                >
                  {m.isEnabled ? "active" : "off"}
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-1.5 rounded-lg flex-shrink-0 text-xs"
                  style={{ color: "var(--cognos-muted)", border: "1px solid var(--cognos-border)" }}
                  title="Delete memory"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
