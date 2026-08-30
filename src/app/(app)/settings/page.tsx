"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useCognos } from "@/lib/cognos-context";

export default function SettingsPage() {
  const router = useRouter();
  const { activeWorkspace, workspaces, sessions, currentUser, logout } = useCognos();
  const [health, setHealth] = useState<{ ok: boolean } | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const [insightCount, setInsightCount] = useState(0);
  const [activityCount, setActivityCount] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/auth/delete-account", { method: "POST" });
      if (res.ok) {
        router.push("/register");
      } else {
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, []);

  useEffect(() => {
    if (!activeWorkspace) return;
    fetch(`/api/memories?workspaceId=${activeWorkspace.id}`)
      .then((r) => r.json())
      .then((d) => setMemoryCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
    fetch(`/api/insights?workspaceId=${activeWorkspace.id}`)
      .then((r) => r.json())
      .then((d) => setInsightCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
    fetch(`/api/activity?workspaceId=${activeWorkspace.id}`)
      .then((r) => r.json())
      .then((d) => setActivityCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
  }, [activeWorkspace]);

  const stats = [
    { label: "Workspaces", value: workspaces.length },
    { label: "Threads", value: sessions.length },
    { label: "Memories", value: memoryCount },
    { label: "Insights", value: insightCount },
    { label: "Activity events", value: activityCount },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Settings"
        subtitle="System state and account-level options"
      />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <section className="rounded-2xl p-6" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#c7d2fe" }}>Runtime</h2>
            <div className="space-y-2">
              <Row label="Database">
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: health?.ok ? "#34d39918" : "#f43f5e18",
                    color: health?.ok ? "#34d399" : "#f43f5e",
                    border: `1px solid ${health?.ok ? "#34d39933" : "#f43f5e33"}`,
                  }}
                >
                  {health?.ok === undefined ? "Checking…" : health?.ok ? "Connected" : "Not connected"}
                </span>
              </Row>
              <Row label="Model">
                <span className="text-xs font-mono" style={{ color: "#64748b" }}>
                  {process.env.NEXT_PUBLIC_MODEL || "gpt_5_4"}
                </span>
              </Row>
              <Row label="Memory extraction">
                <span className="text-xs" style={{ color: "#64748b" }}>
                  enabled on chat turns
                </span>
              </Row>
            </div>
          </section>

          <section className="rounded-2xl p-6" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#c7d2fe" }}>Account</h2>
            <Row label="Email">
              <span className="text-sm" style={{ color: "#94a3b8" }}>{currentUser?.email || "—"}</span>
            </Row>
            <Row label="Name">
              <span className="text-sm" style={{ color: "#94a3b8" }}>{currentUser?.name || "—"}</span>
            </Row>
            <Row label="Role">
              <span className="text-sm" style={{ color: "#94a3b8" }}>{currentUser?.role || "user"}</span>
            </Row>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => logout().then(() => router.push("/login"))}
                className="text-sm px-4 py-2 rounded-lg"
                style={{ background: "#1a1f3a", color: "#fca5a5" }}
              >
                Sign out
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm px-4 py-2 rounded-lg"
                  style={{ background: "#7f1d1d", color: "#fecaca" }}
                >
                  Delete account
                </button>
              ) : (
                <>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="text-sm px-4 py-2 rounded-lg"
                    style={{ background: "#dc2626", color: "white" }}
                  >
                    {deleting ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-sm px-4 py-2 rounded-lg"
                    style={{ background: "#1a1f3a", color: "#64748b" }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
            <p className="text-xs mt-3" style={{ color: "#334155" }}>
              Deleting your account removes your workspaces, threads, messages, memories, documents, and insights.
            </p>
          </section>

          <section className="rounded-2xl p-6" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#c7d2fe" }}>Active workspace</h2>
            <div className="text-sm" style={{ color: "#94a3b8" }}>
              {activeWorkspace ? activeWorkspace.name : "No workspace selected"}
            </div>
            {activeWorkspace?.instructions && (
              <p className="text-xs mt-2" style={{ color: "#475569" }}>
                {activeWorkspace.instructions}
              </p>
            )}
          </section>

          <section className="rounded-2xl p-6" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "#c7d2fe" }}>Workspace totals</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: "#080b18", border: "1px solid #1a1f3a" }}>
                  <div className="text-xl font-bold" style={{ color: "#c7d2fe" }}>{s.value}</div>
                  <div className="text-xs mt-1" style={{ color: "#475569" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl p-6" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#c7d2fe" }}>About</h2>
            <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
              COGNOS is a self-hostable cognitive architecture. Messages run through Observer,
              Strategist, Specialist, Synthesizer, Critic, Governor, and an Orchestrator.
              Memories are persisted per workspace and fed back into future turns.
            </p>
            <p className="text-xs mt-3" style={{ color: "#334155" }}>
              No Base44 dependency. Deploy anywhere Next.js runs.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm" style={{ color: "#94a3b8" }}>{label}</span>
      {children}
    </div>
  );
}
