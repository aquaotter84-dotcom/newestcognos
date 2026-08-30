"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, Workspace } from "@/types/cognos";

type CognosContextValue = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  sessions: Session[];
  loading: boolean;
  refreshWorkspaces: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  setActiveWorkspace: (id: string) => void;
  createSession: (title?: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
};

const CognosContext = createContext<CognosContextValue | null>(null);

export function CognosProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      const data = (await res.json()) as Workspace[];
      setWorkspaces(data);
      setActiveWorkspaceId((prev) => {
        if (prev && data.some((w) => w.id === prev)) return prev;
        return data.find((w) => w.isDefault)?.id || data[0]?.id || null;
      });
    } catch {
      setWorkspaces([]);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    const wsId = activeWorkspaceId;
    if (!wsId) {
      setSessions([]);
      return;
    }
    try {
      const res = await fetch(`/api/sessions?workspaceId=${wsId}`);
      const data = (await res.json()) as Session[];
      setSessions(data);
    } catch {
      setSessions([]);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    (async () => {
      await refreshWorkspaces();
      setLoading(false);
    })();
  }, [refreshWorkspaces]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const setActiveWorkspace = useCallback(
    (id: string) => {
      setActiveWorkspaceId(id);
      setSessions([]);
    },
    []
  );

  const createSession = useCallback(async (title = "New Session") => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, workspaceId: activeWorkspaceId }),
    });
    const session = (await res.json()) as Session;
    await refreshSessions();
    return session;
  }, [activeWorkspaceId, refreshSessions]);

  const deleteSession = useCallback(async (id: string) => {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    await refreshSessions();
  }, [refreshSessions]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || null;

  return (
    <CognosContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        activeWorkspaceId,
        sessions,
        loading,
        refreshWorkspaces,
        refreshSessions,
        setActiveWorkspace,
        createSession,
        deleteSession,
      }}
    >
      {children}
    </CognosContext.Provider>
  );
}

export function useCognos() {
  const ctx = useContext(CognosContext);
  if (!ctx) throw new Error("useCognos must be used inside CognosProvider");
  return ctx;
}
