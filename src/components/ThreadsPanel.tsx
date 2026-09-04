"use client";

import { useRouter } from "next/navigation";
import type { Session } from "@/types";

type Props = {
  sessions: Session[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onNavigate: () => void;
};

function formatSessionDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function ThreadsPanel({
  sessions,
  activeSessionId,
  onNewChat,
  onDelete,
  onNavigate,
}: Props) {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 pb-3 flex-shrink-0">
        <button
          onClick={() => {
            onNewChat();
            onNavigate();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: "linear-gradient(135deg, #1e3a8a22, #4f7aff22)",
            border: "1px solid #4f7aff33",
            color: "#7cb9ff",
          }}
        >
          <span>+</span>
          <span>New conversation</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="text-[10px] font-mono tracking-wider px-2 py-1" style={{ color: "var(--cognos-faint)" }}>
          CONVERSATIONS
        </div>
        {sessions.length === 0 ? (
          <div className="text-xs px-3 py-4 text-center" style={{ color: "var(--cognos-faint)" }}>
            No conversations yet.
            <br />
            The first message starts one.
          </div>
        ) : (
          sessions.map((s) => {
            const active = s.id === activeSessionId;
            return (
              <div key={s.id} className="group relative">
                <button
                  onClick={() => {
                    router.push(`/?c=${s.id}`);
                    onNavigate();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg transition-colors"
                  style={{
                    background: active ? "var(--cognos-border)" : "transparent",
                    color: active ? "#c7d2fe" : "var(--cognos-muted)",
                  }}
                >
                  <div className="truncate text-sm pr-6">{s.title}</div>
                  <div className="text-[11px] mt-0.5 flex items-center gap-2" style={{ color: "var(--cognos-faint)" }}>
                    <span>{formatSessionDate(s.updatedAt)}</span>
                    {s.lastMessagePreview && (
                      <span className="truncate flex-1">
                        {s.lastMessagePreview.slice(0, 40)}
                        {s.lastMessagePreview.length > 40 ? "…" : ""}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                  className="absolute right-2 top-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-all text-xs"
                  style={{ color: "var(--cognos-muted)", background: "var(--cognos-surface)" }}
                  title="Delete conversation"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      <div
        className="p-3 flex-shrink-0 text-[10px] flex items-center gap-1.5"
        style={{ borderTop: "1px solid var(--cognos-border)", color: "var(--cognos-faint)" }}
      >
        <span className="council-active inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--cognos-accent)" }} />
        Council of six · Truth, Evidence, Agency, Dignity
      </div>
    </div>
  );
}
