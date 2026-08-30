"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useCognos } from "@/lib/cognos-context";
import type { Session } from "@/types/cognos";

export default function ThreadsPage() {
  const router = useRouter();
  const { sessions, deleteSession } = useCognos();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      (s.lastMessagePreview || "").toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (s: Session) => {
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) {
      setEditingId(null);
      return;
    }
    await fetch("/api/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, title: editTitle.trim() }),
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    setConfirmId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Threads"
        subtitle="Every conversation in the active workspace"
        actions={
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search threads…"
            className="text-sm px-3 py-1.5 rounded-lg outline-none w-48"
            style={{
              background: "#0c0f1e",
              border: "1px solid #1a1f3a",
              color: "#e2e8f0",
            }}
          />
        }
      />
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-sm" style={{ color: "#475569" }}>
            No threads yet. Start a chat from the sidebar.
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {filtered.map((s) => (
              <div
                key={s.id}
                className="rounded-xl p-4 flex items-center gap-3"
                style={{
                  background: "#0c0f1e",
                  border: "1px solid #1a1f3a",
                }}
              >
                <div className="flex-1 min-w-0">
                  {editingId === s.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full text-sm px-2 py-1 rounded outline-none"
                      style={{
                        background: "#080b18",
                        border: "1px solid #4f7aff44",
                        color: "#e2e8f0",
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => router.push(`/?c=${s.id}`)}
                      className="text-left w-full"
                    >
                      <div className="text-sm font-medium truncate" style={{ color: "#c7d2fe" }}>
                        {s.title}
                      </div>
                      {s.lastMessagePreview && (
                        <div className="text-xs mt-1 truncate" style={{ color: "#475569" }}>
                          {s.lastMessagePreview}
                        </div>
                      )}
                    </button>
                  )}
                  <div className="text-xs mt-1" style={{ color: "#334155" }}>
                    {new Date(s.updatedAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {confirmId !== s.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(s)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ color: "#64748b" }}
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => setConfirmId(s.id)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ color: "#64748b" }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: "#f59e0b" }}>
                      Delete?
                    </span>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: "#7f1d1d", color: "#fecaca" }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: "#1a1f3a", color: "#64748b" }}
                    >
                      No
                    </button>
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
