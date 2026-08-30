"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCognos } from "@/lib/cognos-context";
import type { Session } from "@/types/cognos";

const NAV_ITEMS = [
  { href: "/", label: "Chat", icon: "◈" },
  { href: "/threads", label: "Threads", icon: "▤" },
  { href: "/memory", label: "Memory", icon: "⬡" },
  { href: "/activity", label: "Activity", icon: "↯" },
  { href: "/insights", label: "Insights", icon: "✦" },
  { href: "/documents", label: "Documents", icon: "▥" },
  { href: "/beliefs", label: "Beliefs", icon: "◎" },
  { href: "/dynamics", label: "Dynamics", icon: "≋" },
  { href: "/system", label: "System", icon: "⬢" },
  { href: "/agent", label: "Agent", icon: "✳" },
  { href: "/workspaces", label: "Workspaces", icon: "◫" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

function formatSessionDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function SessionItem({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: Session;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
        style={{
          background: active ? "#1a1f3a" : "transparent",
          color: active ? "#c7d2fe" : "#64748b",
        }}
      >
        <div className="truncate pr-5">{session.title}</div>
        <div className="text-xs mt-0.5" style={{ color: "#334155" }}>
          {formatSessionDate(session.updatedAt)}
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 rounded transition-all text-xs"
        style={{ color: "#475569" }}
        title="Delete thread"
      >
        ✕
      </button>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    sessions,
    setActiveWorkspace,
    createSession,
    deleteSession,
  } = useCognos();

  const [isOpen, setIsOpen] = useState(false);

  const handleNewChat = async () => {
    const session = await createSession("New Session");
    router.push(`/?c=${session.id}`);
    setIsOpen(false);
  };

  const handleSelectSession = (id: string) => {
    router.push(`/?c=${id}`);
    setIsOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    deleteSession(id).catch(() => {});
  };

  const handleWorkspaceChange = (id: string) => {
    setActiveWorkspace(id);
    router.push("/");
    setIsOpen(false);
  };

  const nav = (
    <nav className="flex-1 overflow-y-auto px-2 pb-2">
      <div className="text-xs px-2 py-1 mb-1" style={{ color: "#334155" }}>
        WORKSPACE
      </div>
      <select
        value={activeWorkspaceId || ""}
        onChange={(e) => handleWorkspaceChange(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-lg outline-none mb-2"
        style={{
          background: "#0c0f1e",
          border: "1px solid #1a1f3a",
          color: "#c7d2fe",
        }}
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id} style={{ background: "#0c0f1e" }}>
            {w.name}
          </option>
        ))}
      </select>

      <button
        onClick={handleNewChat}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
        style={{
          background: "linear-gradient(135deg, #1e3a8a22, #4f7aff22)",
          border: "1px solid #4f7aff33",
          color: "#7cb9ff",
        }}
      >
        <span>+</span>
        <span>New Chat</span>
      </button>

      <div className="text-xs px-2 py-1 mt-3 mb-1" style={{ color: "#334155" }}>
        SESSIONS
      </div>
      {sessions.length === 0 ? (
        <div className="text-xs px-3 py-2" style={{ color: "#334155" }}>
          No sessions yet
        </div>
      ) : (
        sessions.map((s) => (
          <SessionItem
            key={s.id}
            session={s}
            active={false}
            onSelect={() => handleSelectSession(s.id)}
            onDelete={() => handleDeleteSession(s.id)}
          />
        ))
      )}

      <div className="text-xs px-2 py-1 mt-4 mb-1" style={{ color: "#334155" }}>
        MODULES
      </div>
      {NAV_ITEMS.slice(1).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setIsOpen(false)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === item.href ? "bg-[#1a1f3a]" : "hover:bg-[#0c0f1e]"
          }`}
          style={{
            color: pathname === item.href ? "#c7d2fe" : "#64748b",
          }}
        >
          <span className="text-xs" style={{ color: "#4f7aff" }}>
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#05070f" }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{
          width: "250px",
          background: "#080b18",
          borderRight: "1px solid #1a1f3a",
        }}
      >
        <div className="p-5 pb-4" style={{ borderBottom: "1px solid #1a1f3a" }}>
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm council-active"
              style={{
                background: "linear-gradient(135deg, #1e3a8a, #4f7aff22)",
                border: "1px solid #4f7aff44",
              }}
            >
              ⬡
            </div>
            <div>
              <div
                className="font-bold text-sm tracking-widest"
                style={{ color: "#c7d2fe", letterSpacing: "0.15em" }}
              >
                COGNOS
              </div>
              <div className="text-xs" style={{ color: "#334155" }}>
                Cognitive Architecture
              </div>
            </div>
          </Link>
        </div>
        {nav}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.65)" }}
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute left-0 top-0 bottom-0 w-[270px] flex flex-col"
            style={{ background: "#080b18", borderRight: "1px solid #1a1f3a" }}
          >
            <div className="p-5 pb-4" style={{ borderBottom: "1px solid #1a1f3a" }}>
              <div className="font-bold text-sm tracking-widest" style={{ color: "#c7d2fe" }}>
                COGNOS
              </div>
            </div>
            {nav}
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>

      {/* Mobile top bar */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-3 left-3 lg:hidden p-2 rounded-lg z-30"
        style={{ background: "#0c0f1e", border: "1px solid #1a1f3a", color: "#64748b" }}
      >
        ☰
      </button>
    </div>
  );
}
