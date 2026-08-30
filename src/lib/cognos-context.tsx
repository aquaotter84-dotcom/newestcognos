"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Session, User, Workspace } from "@/types/cognos";

type CognosContextValue = {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  sessions: Session[];
  loading: boolean;
  refreshAuth: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  setActiveWorkspace: (id: string) => void;
  createSession: (title?: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  logout: () => Promise<void>;
};

const CognosContext = createContext<CognosContextValue | null>(null);

export function CognosProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        setCurrentUser(null);
        setIsAuthenticated(false);
        return;
      }
      const data = (await res.json()) as User;
      setCurrentUser(data);
      setIsAuthenticated(true);
    } catch {
      setCurrentUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (!res.ok) {
        setWorkspaces([]);
        return;
      }
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
      if (!res.ok) {
        setSessions([]);
        return;
      }
      const data = (await res.json()) as Session[];
      setSessions(data);
    } catch {
      setSessions([]);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    (async () => {
      await refreshAuth();
      setLoading(false);
    })();
  }, [refreshAuth]);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshWorkspaces();
  }, [isAuthenticated, refreshWorkspaces]);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshSessions();
  }, [isAuthenticated, refreshSessions]);

  const setActiveWorkspace = useCallback(
    (id: string) => {
      setActiveWorkspaceId(id);
      setSessions([]);
    },
    []
  );

  const createSession = useCallback(
    async (title = "New Session") => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, workspaceId: activeWorkspaceId }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const session = (await res.json()) as Session;
      await refreshSessions();
      return session;
    },
    [activeWorkspaceId, refreshSessions]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      await refreshSessions();
    },
    [refreshSessions]
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setIsAuthenticated(false);
    setWorkspaces([]);
    setSessions([]);
    router.push("/login");
  }, [router]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || null;

  return (
    <CognosContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLoadingAuth,
        workspaces,
        activeWorkspace,
        activeWorkspaceId,
        sessions,
        loading,
        refreshAuth,
        refreshWorkspaces,
        refreshSessions,
        setActiveWorkspace,
        createSession,
        deleteSession,
        logout,
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
