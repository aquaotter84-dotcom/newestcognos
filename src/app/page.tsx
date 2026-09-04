"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import MessageBubble from "@/components/MessageBubble";
import ThinkingIndicator from "@/components/ThinkingIndicator";
import ChatInput from "@/components/ChatInput";
import ThreadsPanel from "@/components/ThreadsPanel";
import type { Message, Session } from "@/types";

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSessionId = searchParams.get("c");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [thinkingStage, setThinkingStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<string>("balanced");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Typewriter reveal of the completed assistant message.
  const [streaming, setStreaming] = useState<{ id: string; full: string; revealed: string } | null>(null);
  const streamingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const thinkingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tempIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const stopStreaming = useCallback(() => {
    if (streamingRef.current) {
      clearInterval(streamingRef.current);
      streamingRef.current = null;
    }
    setStreaming(null);
  }, []);

  const stopThinkingAnimation = useCallback(() => {
    if (thinkingInterval.current) {
      clearInterval(thinkingInterval.current);
      thinkingInterval.current = null;
    }
  }, []);

  useEffect(() => () => {
    stopStreaming();
    stopThinkingAnimation();
    abortRef.current?.abort();
  }, [stopStreaming, stopThinkingAnimation]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as Session[];
        if (Array.isArray(data)) setSessions(data);
      }
    } catch {
      // non-fatal: the drawer simply stays empty
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load the conversation when the ?c= param changes.
  useEffect(() => {
    stopStreaming();
    setError(null);
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/sessions/${activeSessionId}/messages`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMessages(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, stopStreaming]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking, streaming?.revealed.length]);

  const startThinkingAnimation = () => {
    setThinkingStage(0);
    let stage = 0;
    thinkingInterval.current = setInterval(() => {
      stage = Math.min(stage + 1, 5);
      setThinkingStage(stage);
    }, 1500);
  };

  const startStreaming = (message: Message) => {
    stopStreaming();
    const full = message.content;
    if (!full) return;
    let revealed = "";
    const chunk = Math.max(3, Math.ceil(full.length / 80));
    setStreaming({ id: message.id, full, revealed });
    streamingRef.current = setInterval(() => {
      revealed = full.slice(0, Math.min(full.length, revealed.length + chunk));
      setStreaming({ id: message.id, full, revealed });
      if (revealed.length >= full.length) {
        stopStreaming();
      }
    }, 18);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopStreaming();
    if (tempIdRef.current) {
      const id = tempIdRef.current;
      setMessages((prev) => prev.filter((m) => m.id !== id));
      tempIdRef.current = null;
    }
    stopThinkingAnimation();
    setThinking(false);
    setThinkingStage(0);
    setError(null);
  };

  const handleSend = async (content: string) => {
    let sessionId = activeSessionId;
    if (!sessionId) {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: content.slice(0, 60) }),
      });
      if (!res.ok) {
        setError("Could not start a new conversation.");
        return;
      }
      const session = (await res.json()) as Session;
      sessionId = session.id;
      router.replace(`/?c=${session.id}`, { scroll: false });
    }

    setError(null);
    setThinking(true);
    startThinkingAnimation();

    const tempUserMsg: Message = {
      id: `temp-${crypto.randomUUID()}`,
      sessionId,
      role: "user",
      content,
      modelUsed: null,
      councilTrace: null,
      createdAt: new Date().toISOString(),
    };
    tempIdRef.current = tempUserMsg.id;
    setMessages((prev) => [...prev, tempUserMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, content, style }),
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        userMessage?: Message;
        assistantMessage?: Message;
        session?: Session;
        error?: string;
      };
      const assistantMessage = data.assistantMessage;
      if (!res.ok || !assistantMessage) {
        throw new Error(data.error || "The council could not complete its deliberation.");
      }
      const userMessage: Message =
        data.userMessage ?? { ...tempUserMsg, id: crypto.randomUUID() };

      tempIdRef.current = null;
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        userMessage,
        assistantMessage,
      ]);
      startStreaming(assistantMessage);
      if (data.session) {
        setSessions((prev) => [data.session!, ...prev.filter((s) => s.id !== data.session!.id)]);
      } else {
        loadSessions();
      }
    } catch (err) {
      if (tempIdRef.current) {
        const id = tempIdRef.current;
        setMessages((prev) => prev.filter((m) => m.id !== id));
        tempIdRef.current = null;
      }
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "An error occurred.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      stopThinkingAnimation();
      setThinking(false);
      setThinkingStage(0);
    }
  };

  const handleNewChat = () => {
    router.push("/");
  };

  const handleDelete = async (id: string) => {
    const wasActive = id === activeSessionId;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (wasActive) {
      setMessages([]);
      router.replace("/", { scroll: false });
    }
    await fetch(`/api/sessions/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: "var(--cognos-bg)" }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0"
        style={{ width: 260, background: "var(--cognos-surface-2)", borderRight: "1px solid var(--cognos-border)" }}
      >
        <div className="p-4 flex-shrink-0 flex items-center gap-2.5" style={{ borderBottom: "1px solid var(--cognos-border)" }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{
              background: "linear-gradient(135deg, #1e3a8a, #4f7aff22)",
              border: "1px solid #4f7aff44",
              color: "var(--cognos-accent)",
            }}
          >
            ⬡
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm tracking-[0.18em]" style={{ color: "#c7d2fe" }}>
              COGNOS
            </div>
            <div className="text-[10px] truncate" style={{ color: "var(--cognos-faint)" }}>
              One Voice Outward. Many Minds Underneath.
            </div>
          </div>
        </div>
        <ThreadsPanel
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={handleNewChat}
          onDelete={handleDelete}
          onNavigate={() => {}}
        />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.65)" }} onClick={() => setDrawerOpen(false)} />
          <div
            className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[85vw] flex flex-col"
            style={{ background: "var(--cognos-surface-2)", borderRight: "1px solid var(--cognos-border)" }}
          >
            <div className="p-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--cognos-border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-base" style={{ color: "var(--cognos-accent)" }}>⬡</span>
                <span className="font-bold text-sm tracking-[0.18em]" style={{ color: "#c7d2fe" }}>COGNOS</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1 text-sm" style={{ color: "var(--cognos-muted)" }}>
                ✕
              </button>
            </div>
            <ThreadsPanel
              sessions={sessions}
              activeSessionId={activeSessionId}
              onNewChat={handleNewChat}
              onDelete={handleDelete}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main column */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--cognos-border)", background: "var(--cognos-bg)" }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden p-1.5 -ml-1 rounded-lg text-sm flex-shrink-0"
            style={{ color: "var(--cognos-muted)", border: "1px solid var(--cognos-border)", background: "var(--cognos-surface)" }}
            aria-label="Open conversations"
          >
            ☰
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-medium truncate" style={{ color: "#c7d2fe" }}>
              {activeSessionId ? activeSession?.title ?? "Conversation" : "COGNOS"}
            </h1>
            <p className="text-[10px] hidden sm:block" style={{ color: "var(--cognos-faint)" }}>
              One Voice Outward. Many Minds Underneath.
            </p>
          </div>

          <div
            className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full flex-shrink-0"
            style={{ background: "var(--cognos-surface)", border: "1px solid var(--cognos-border)", color: "var(--cognos-muted)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: thinking ? "var(--cognos-critic)" : "var(--cognos-governor)" }}
            />
            <span className="hidden sm:inline">{thinking ? "Deliberating" : "Ready"}</span>
          </div>

          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            disabled={thinking}
            className="text-[11px] px-2 py-1 rounded-full outline-none flex-shrink-0 max-w-[92px] sm:max-w-none"
            style={{ background: "var(--cognos-surface)", border: "1px solid var(--cognos-border)", color: "var(--cognos-strategist)" }}
            title="Communication style"
          >
            <option value="balanced">Balanced</option>
            <option value="casual">Casual</option>
            <option value="technical">Technical</option>
            <option value="strategic">Strategic</option>
          </select>

          <Link
            href="/memory"
            className="text-[11px] px-2 py-1 rounded-full transition-colors flex-shrink-0"
            style={{ background: "var(--cognos-surface)", border: "1px solid var(--cognos-border)", color: "var(--cognos-strategist)" }}
            title="Long-term memory"
          >
            ⬡ <span className="hidden sm:inline">Memory</span>
          </Link>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-5 space-y-5">
          {messages.length === 0 && !thinking ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-5 council-active"
                style={{ background: "linear-gradient(135deg, var(--cognos-surface), var(--cognos-border))", border: "1px solid #4f7aff33", color: "var(--cognos-accent)" }}
              >
                ⬡
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: "#c7d2fe", letterSpacing: "0.22em" }}>
                COGNOS
              </h2>
              <p className="text-sm mb-1" style={{ color: "var(--cognos-muted)" }}>
                Cognitive Operators for Guidance, Navigation, Oversight &amp; Sovereignty
              </p>
              <p className="text-xs mb-7" style={{ color: "var(--cognos-faint)" }}>
                One Voice Outward. Many Minds Underneath.
              </p>

              <div className="flex items-center gap-2 sm:gap-3 mb-7">
                {(["observer", "strategist", "specialist", "synthesizer", "critic", "governor"] as const).map((op, i) => (
                  <div key={op} className="flex items-center gap-2 sm:gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                        style={{
                          background:
                            {
                              observer: "#38bdf812",
                              strategist: "#a78bfa12",
                              specialist: "#f472b612",
                              synthesizer: "#4f7aff12",
                              critic: "#f59e0b12",
                              governor: "#34d39912",
                            }[op],
                          border:
                            "1px solid " +
                            {
                              observer: "#38bdf833",
                              strategist: "#a78bfa33",
                              specialist: "#f472b633",
                              synthesizer: "#4f7aff33",
                              critic: "#f59e0b33",
                              governor: "#34d39933",
                            }[op],
                          color: {
                            observer: "#38bdf8",
                            strategist: "#a78bfa",
                            specialist: "#f472b6",
                            synthesizer: "#4f7aff",
                            critic: "#f59e0b",
                            governor: "#34d399",
                          }[op],
                        }}
                      >
                        {
                          {
                            observer: "◎",
                            strategist: "◈",
                            specialist: "✳",
                            synthesizer: "⬡",
                            critic: "◉",
                            governor: "◆",
                          }[op]
                        }
                      </div>
                      <span className="text-[10px] hidden sm:inline" style={{ color: "var(--cognos-faint)" }}>
                        {
                          {
                            observer: "Observer",
                            strategist: "Strategist",
                            specialist: "Specialist",
                            synthesizer: "Synthesizer",
                            critic: "Critic",
                            governor: "Governor",
                          }[op]
                        }
                      </span>
                    </div>
                    {i < 5 && <span className="text-xs hidden sm:inline" style={{ color: "#1e293b" }}>→</span>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                {[
                  "Help me think through a difficult decision I'm facing",
                  "What should I consider when starting a new project?",
                  "I need to plan my long-term goals — where do I start?",
                  "Challenge my thinking on a belief I hold strongly",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    disabled={thinking}
                    className="text-left text-xs px-3 py-2.5 rounded-xl transition-colors"
                    style={{ background: "var(--cognos-surface)", border: "1px solid var(--cognos-border)", color: "var(--cognos-muted)" }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  displayContent={streaming?.id === msg.id ? streaming.revealed : undefined}
                />
              ))}
              {thinking && <ThinkingIndicator stage={thinkingStage} />}
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm animate-slide-up" style={{ background: "#1a0505", border: "1px solid #7f1d1d44", color: "#fca5a5" }}>
              <span>⚠</span>
              <div>
                <strong>Error:</strong> {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <ChatInput onSend={handleSend} isProcessing={thinking} onStop={handleStop} />
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center h-dvh"
          style={{ background: "var(--cognos-bg)" }}
        >
          <div className="w-8 h-8 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}
