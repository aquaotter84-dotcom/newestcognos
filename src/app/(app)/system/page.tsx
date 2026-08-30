"use client";

import PageHeader from "@/components/PageHeader";

const OPERATORS = [
  { icon: "◎", label: "Observer", layer: "Guidance", color: "#38bdf8", desc: "Perceives intent, context, ambiguity, and emotional state." },
  { icon: "◈", label: "Strategist", layer: "Navigation", color: "#a78bfa", desc: "Frames the problem and maps approaches and constraints." },
  { icon: "✳", label: "Specialist", layer: "Execution", color: "#f472b6", desc: "Produces the substantive draft or decomposes into sub-tasks." },
  { icon: "⬡", label: "Synthesizer", layer: "Integration", color: "#4f7aff", desc: "Merges council outputs into a coherent final draft." },
  { icon: "◉", label: "Critic", layer: "Oversight", color: "#f59e0b", desc: "Audits the draft, surfaces risks, and triggers revisions." },
  { icon: "◆", label: "Governor", layer: "Sovereignty", color: "#34d399", desc: "Preserves user agency and recommends durable memory." },
];

export default function SystemPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="System"
        subtitle="Cognitive architecture map"
      />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <section className="rounded-2xl p-6" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
            <h2 className="text-sm font-semibold mb-2" style={{ color: "#c7d2fe" }}>
              The Council
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
              Every message enters a six-operator council before one voice goes outward.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
              {OPERATORS.map((op) => (
                <div key={op.label} className="rounded-xl p-4" style={{ background: "#080b18", border: `1px solid ${op.color}22` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: op.color }}>{op.icon}</span>
                    <span className="text-sm font-medium" style={{ color: "#c7d2fe" }}>{op.label}</span>
                    <span className="text-xs ml-auto" style={{ color: op.color }}>{op.layer}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{op.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl p-6" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#c7d2fe" }}>Pipeline</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {["User", "Observer", "Strategist", "Specialist", "Synthesizer", "Critic", "Governor", "Response"].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span
                    className="px-3 py-1.5 rounded-lg"
                    style={{ background: "#1a1f3a", color: i === 0 || i === arr.length - 1 ? "#c7d2fe" : "#94a3b8", border: "1px solid #1a1f3a" }}
                  >
                    {step}
                  </span>
                  {i < arr.length - 1 && <span style={{ color: "#334155" }}>→</span>}
                </span>
              ))}
            </div>
            <p className="text-xs mt-4" style={{ color: "#475569" }}>
              The Critic can trigger one or more synthesis revisions before the Governor
              signs off. Simple requests skip the revision loop for efficiency.
            </p>
          </section>

          <section className="rounded-2xl p-6" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#c7d2fe" }}>Storage</h2>
            <div className="space-y-2 text-xs" style={{ color: "#64748b" }}>
              <div>• Sessions / conversations persist per workspace</div>
              <div>• Messages carry council traces and model metadata</div>
              <div>• Memories are tiered short → medium → long → mythic</div>
              <div>• Insights store autonomous deliberations</div>
              <div>• Audit events keep an activity trail</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
