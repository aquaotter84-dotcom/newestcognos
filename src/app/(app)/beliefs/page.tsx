"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useCognos } from "@/lib/cognos-context";
import type { Memory } from "@/types/cognos";
import { EVIDENCE_META } from "@/types/cognos";

function confidence(m: Memory) {
  const evidence = { direct: 1, repeated: 0.85, inferred: 0.7, assumed: 0.45 }[m.evidenceLevel];
  const volatility = { low: 1, medium: 0.85, high: 0.7 }[m.volatility];
  return Math.round(Math.min(100, (m.importance / 10) * evidence * volatility * 100));
}

function category(m: Memory) {
  const key = m.key.toLowerCase();
  if (["identity", "name", "mythic", "purpose", "direction"].some((x) => key.includes(x))) return "Identity";
  if (["project", "goal", "plan", "mission"].some((x) => key.includes(x))) return "Direction";
  if (["prefer", "style", "communication", "tone"].some((x) => key.includes(x))) return "Preferences";
  if (["work", "career", "role", "job"].some((x) => key.includes(x))) return "Work";
  return "Knowledge";
}

export default function BeliefsPage() {
  const { activeWorkspace } = useCognos();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) return;
    setLoading(true);
    fetch(`/api/memories?workspaceId=${activeWorkspace.id}`)
      .then((r) => r.json())
      .then((d) => setMemories(Array.isArray(d) ? d.filter((m) => m.isEnabled) : []))
      .catch(() => setMemories([]))
      .finally(() => setLoading(false));
  }, [activeWorkspace]);

  const groups = memories.reduce<Record<string, Memory[]>>((acc, m) => {
    const c = category(m);
    acc[c] = acc[c] || [];
    acc[c].push(m);
    return acc;
  }, {});

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Beliefs"
        subtitle="The durable picture COGNOS has formed from enabled memory"
      />
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: "#475569" }}>Loading…</div>
        ) : memories.length === 0 ? (
          <div className="text-center py-16" style={{ color: "#475569" }}>
            <div className="text-3xl mb-2">◎</div>
            <div className="text-sm">No beliefs derived yet</div>
            <div className="text-xs mt-1">The council stores beliefs as memories during conversation</div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            {Object.entries(groups).map(([cat, items]) => (
              <section key={cat} className="rounded-2xl p-4" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
                <h2 className="text-sm font-semibold mb-3" style={{ color: "#c7d2fe" }}>{cat}</h2>
                <div className="space-y-2">
                  {items.map((m) => {
                    const conf = confidence(m);
                    const color = EVIDENCE_META[m.evidenceLevel].color;
                    return (
                      <div key={m.id} className="rounded-xl p-3 flex items-start gap-3" style={{ background: "#080b18", border: "1px solid #1a1f3a" }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm" style={{ color: "#c7d2fe" }}>{m.value}</div>
                          <div className="text-xs mt-1 flex gap-2 flex-wrap" style={{ color: "#475569" }}>
                            <span>{m.key}</span>
                            <span style={{ color }}>{EVIDENCE_META[m.evidenceLevel].label}</span>
                            <span>volatility: {m.volatility}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 w-16 text-right">
                          <div className="text-sm font-semibold" style={{ color }}>{conf}%</div>
                          <div className="text-xs" style={{ color: "#334155" }}>confidence</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
