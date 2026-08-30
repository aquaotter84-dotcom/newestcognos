"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useCognos } from "@/lib/cognos-context";
import type { Workspace } from "@/types/cognos";

const COLORS = ["#3B82F6", "#7C3AED", "#10B981", "#F59E0B", "#F43F5E", "#06B6D4"];
const ICONS = ["Brain", "Briefcase", "FlaskConical", "Palette", "Rocket", "BookOpen", "Heart", "Code"];

type Form = {
  name: string;
  description: string;
  instructions: string;
  color: string;
  icon: string;
};

const emptyForm: Form = {
  name: "",
  description: "",
  instructions: "",
  color: "#3B82F6",
  icon: "Brain",
};

function glyph(icon: string) {
  return icon === "Brain" ? "⬡" : icon === "Briefcase" ? "▤" : icon === "BookOpen" ? "▥" : "◫";
}

export default function WorkspacesPage() {
  const router = useRouter();
  const { workspaces, activeWorkspaceId, setActiveWorkspace, refreshWorkspaces } = useCognos();
  const [form, setForm] = useState<Form>(emptyForm);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAdding(true);
  };

  const openEdit = (ws: Workspace) => {
    setForm({
      name: ws.name,
      description: ws.description || "",
      instructions: ws.instructions || "",
      color: ws.color,
      icon: ws.icon,
    });
    setEditingId(ws.id);
    setAdding(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setError(null);
    if (!editingId) {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create workspace");
        return;
      }
    } else {
      const res = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...form }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update workspace");
        return;
      }
    }
    await refreshWorkspaces();
    setAdding(false);
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/workspaces?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete workspace");
      return;
    }
    await refreshWorkspaces();
    router.push("/");
    setConfirmId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Workspaces"
        subtitle="Separate cognitive contexts for different work"
        actions={
          <button onClick={openAdd} className="text-sm px-3 py-1.5 rounded-lg font-medium" style={{ background: "#4f7aff", color: "white" }}>
            + New
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div
            className="max-w-3xl mx-auto mb-3 text-sm px-4 py-2 rounded-xl"
            style={{ background: "#1a0505", border: "1px solid #7f1d1d44", color: "#fca5a5" }}
          >
            {error}
          </div>
        )}

        {adding && (
          <div className="max-w-3xl mx-auto rounded-2xl p-4 mb-5 space-y-3" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Workspace name"
              className="w-full text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
            />
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Description (optional)"
              className="w-full text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
            />
            <textarea
              value={form.instructions}
              onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
              placeholder="System instructions that shape COGNOS for this workspace (optional)"
              rows={3}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
              style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
            />
            <div className="flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className="w-7 h-7 rounded-full"
                  style={{ background: c, border: form.color === c ? "2px solid white" : "2px solid transparent" }}
                />
              ))}
              {ICONS.map((i) => (
                <button
                  key={i}
                  onClick={() => setForm((p) => ({ ...p, icon: i }))}
                  className="w-8 h-8 rounded-lg text-sm"
                  style={{
                    background: form.icon === i ? "#4f7aff22" : "#1a1f3a",
                    color: form.icon === i ? "#4f7aff" : "#64748b",
                    border: `1px solid ${form.icon === i ? "#4f7aff44" : "#1a1f3a"}`,
                  }}
                >
                  {glyph(i)}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={save} className="text-sm px-4 py-2 rounded-lg font-medium flex-1" style={{ background: "#4f7aff", color: "white" }}>
                {editingId ? "Save changes" : "Create workspace"}
              </button>
              <button onClick={() => setAdding(false)} className="text-sm px-4 py-2 rounded-lg" style={{ background: "#1a1f3a", color: "#64748b" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-2">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="rounded-xl p-4 flex items-center gap-3"
              style={{
                background: "#0c0f1e",
                border: `1px solid ${ws.id === activeWorkspaceId ? `${ws.color}44` : "#1a1f3a"}`,
              }}
            >
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: `${ws.color}18`, color: ws.color, border: `1px solid ${ws.color}33` }}
              >
                {glyph(ws.icon)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: "#c7d2fe" }}>
                  {ws.name} {ws.isDefault && <span className="text-xs ml-1" style={{ color: "#64748b" }}>default</span>}
                </div>
                {ws.description && <div className="text-xs mt-0.5" style={{ color: "#475569" }}>{ws.description}</div>}
                {ws.instructions && <div className="text-xs mt-1 truncate" style={{ color: "#334155" }}>{ws.instructions}</div>}
              </div>
              <div className="flex items-center gap-1">
                {ws.id !== activeWorkspaceId && (
                  <button onClick={() => setActiveWorkspace(ws.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "#1a1f3a", color: "#4f7aff" }}>
                    Switch
                  </button>
                )}
                <button onClick={() => openEdit(ws)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#64748b" }}>✎</button>
                {confirmId === ws.id ? (
                  <>
                    <button onClick={() => remove(ws.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "#7f1d1d", color: "#fecaca" }}>Yes</button>
                    <button onClick={() => setConfirmId(null)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "#1a1f3a", color: "#64748b" }}>No</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmId(ws.id)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#64748b" }}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
