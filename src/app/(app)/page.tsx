"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MessageBubble from "@/components/MessageBubble";
import ThinkingIndicator from "@/components/ThinkingIndicator";
import ChatInput from "@/components/ChatInput";
import { useCognos } from "@/lib/cognos-context";
import { useSpeechSynthesis } from "@/hooks/use-voice";
import type { Message, DocumentRecord } from "@/types/cognos";

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSessionId = searchParams.get("c");
  const { sessions, activeWorkspace, createSession, refreshSessions } = useCognos();
  const { speak, cancel } = useSpeechSynthesis();

  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [thinkingStage, setThinkingStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<string>("balanced");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const autoSpeakRef = useRef(false);
  const [attachableDocs, setAttachableDocs] = useState<DocumentRecord[]>([]);

  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  useEffect(() => () => cancel(), [cancel]);

  useEffect(() => {
    if (!activeWorkspace) return;
    fetch(`/api/documents?workspaceId=${activeWorkspace.id}`)
      .then((r) => r.json())
      .then((d) => setAttachableDocs(Array.isArray(d) ? d.filter((x: DocumentRecord) => x.processingStatus === "complete") : []))
      .catch(() => setAttachableDocs([]));
  }, [activeWorkspace]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const thinkingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tempIdRef = useRef<string | null>(null);
  const streamingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [streaming, setStreaming] = useState<{
    id: string;
    full: string;
    revealed: string;
  } | null>(null);

  const stopStreaming = () => {
    if (streamingRef.current) {
      clearInterval(streamingRef.current);
      streamingRef.current = null;
    }
    setStreaming(null);
  };

  useEffect(() => {
    stopStreaming();
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    fetch(`/api/messages?sessionId=${activeSessionId}`)
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]));
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const startThinkingAnimation = () => {
    setThinkingStage(0);
    let stage = 0;
    thinkingInterval.current = setInterval(() => {
      stage = Math.min(stage + 1, 5);
      setThinkingStage(stage);
    }, 1600);
  };

  const stopThinkingAnimation = () => {
    if (thinkingInterval.current) {
      clearInterval(thinkingInterval.current);
      thinkingInterval.current = null;
    }
  };

  const startStreaming = (message: Message, onComplete?: () => void) => {
    stopStreaming();
    cancel();
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
        onComplete?.();
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

  const handleSend = async (
    content: string,
    showTrace: boolean,
    webSearch = false,
    attachments: string[] = []
  ) => {
    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await createSession(content.slice(0, 50) || "New Session");
      sessionId = session.id;
      router.replace(`/?c=${session.id}`, { scroll: false });
    }

    setError(null);
    setThinking(true);
    startThinkingAnimation();

    const tempUserMsg: Message = {
      id: `temp-${crypto.randomUUID()}`,
      sessionId,
      workspaceId: "",
      role: "user",
      content,
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
        body: JSON.stringify({ sessionId, content, showTrace, style, webSearch, attachments }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      tempIdRef.current = null;
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        data.userMessage,
        data.assistantMessage,
      ]);
      startStreaming(data.assistantMessage as Message, () => {
        const text = (data.assistantMessage as Message).content;
        if (autoSpeakRef.current && text) speak(text);
      });
      refreshSessions();
    } catch (err) {
      if (controller.signal.aborted) {
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      } else {
        setError(err instanceof Error ? err.message : "An error occurred");
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      tempIdRef.current = null;
      stopThinkingAnimation();
      setThinking(false);
      setThinkingStage(0);
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex-1 flex flex-col min-w-0 relative h-full">
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0 lg:pl-16"
        style={{ borderBottom: "1px solid #1a1f3a", background: "#05070f" }}
      >
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate" style={{ color: "#c7d2fe" }}>
            {activeSession?.title ?? "COGNOS"}
          </h1>
          <p className="text-xs" style={{ color: "#334155" }}>
            One Voice Outward. Many Minds Underneath.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
            style={{
              background: "#0c0f1e",
              border: "1px solid #1a1f3a",
              color: "#475569",
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: thinking ? "#f59e0b" : "#34d399" }}
            />
            <span>{thinking ? "Processing" : "Ready"}</span>
          </div>

          <button
            onClick={() => setAutoSpeak((v) => !v)}
            className="text-xs px-2 py-1 rounded-full transition-colors"
            style={{
              background: "#0c0f1e",
              border: "1px solid #1a1f3a",
              color: autoSpeak ? "#34d399" : "#475569",
            }}
            title="Read responses aloud"
          >
            {autoSpeak ? "◉ Voice on" : "○ Voice off"}
          </button>

          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            disabled={thinking}
            className="text-xs px-2 py-1 rounded-full outline-none"
            style={{
              background: "#0c0f1e",
              border: "1px solid #1a1f3a",
              color: "#a78bfa",
            }}
            title="Communication style"
          >
            <option value="balanced">Balanced</option>
            <option value="casual">Casual</option>
            <option value="technical">Technical</option>
            <option value="strategic">Strategic</option>
          </select>

          <a
            href="/memory"
            className="text-xs px-2 py-1 rounded-full transition-colors"
            style={{
              background: "#0c0f1e",
              border: "1px solid #1a1f3a",
              color: "#a78bfa",
            }}
          >
            ⬡ Memory
          </a>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && !thinking ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6 council-active"
              style={{
                background: "linear-gradient(135deg, #0c0f1e, #1a1f3a)",
                border: "1px solid #4f7aff33",
              }}
            >
              ⬡
            </div>
            <h2
              className="text-2xl font-bold tracking-widest mb-2"
              style={{ color: "#c7d2fe", letterSpacing: "0.2em" }}
            >
              COGNOS
            </h2>
            <p className="text-sm mb-1" style={{ color: "#475569" }}>
              Cognitive Operators for Guidance, Navigation, Oversight & Sovereignty
            </p>
            <p className="text-xs mb-8" style={{ color: "#334155" }}>
              One Voice Outward. Many Minds Underneath.
            </p>

            <div className="flex items-center gap-3 mb-8">
              {[
                { icon: "◎", label: "Observer", color: "#38bdf8" },
                { icon: "◈", label: "Strategist", color: "#a78bfa" },
                { icon: "◉", label: "Critic", color: "#f59e0b" },
                { icon: "◆", label: "Governor", color: "#34d399" },
              ].map((op, i) => (
                <div key={op.label} className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{
                        background: `${op.color}12`,
                        border: `1px solid ${op.color}33`,
                        color: op.color,
                      }}
                    >
                      {op.icon}
                    </div>
                    <span className="text-xs" style={{ color: "#334155" }}>
                      {op.label}
                    </span>
                  </div>
                  {i < 3 && (
                    <span className="text-xs" style={{ color: "#1e293b" }}>→</span>
                  )}
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
                  onClick={() => handleSend(prompt, false, false)}
                  disabled={thinking}
                  className="text-left text-xs px-3 py-2.5 rounded-xl transition-colors"
                  style={{
                    background: "#0c0f1e",
                    border: "1px solid #1a1f3a",
                    color: "#64748b",
                  }}
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
                displayContent={
                  streaming?.id === msg.id ? streaming.revealed : undefined
                }
              />
            ))}
            {thinking && <ThinkingIndicator stage={thinkingStage} />}
          </>
        )}

        {error && (
          <div
            className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
            style={{
              background: "#1a0505",
              border: "1px solid #7f1d1d44",
              color: "#fca5a5",
            }}
          >
            <span>⚠</span>
            <div>
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={thinking}
        isProcessing={thinking}
        onStop={handleStop}
        availableDocuments={attachableDocs}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <ChatPageInner />
    </Suspense>
  );
}
