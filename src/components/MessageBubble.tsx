"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import CouncilTrace from "./CouncilTrace";
import type { Message } from "@/types";

type Props = {
  message: Message;
  /** When the client is revealing the message as a typewriter, this is the
   *  partial text to render instead of message.content. */
  displayContent?: string;
};

export default function MessageBubble({ message, displayContent }: Props) {
  const [showTrace, setShowTrace] = useState(false);
  const isUser = message.role === "user";
  const content = displayContent ?? message.content;
  const trace = !isUser ? message.councilTrace : null;
  const hasTrace = Boolean(trace && Object.keys(trace).length > 0);
  const vetoed = hasTrace && trace!.latent?.governorVetoed === true;

  const timeStr = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
        style={{
          background: isUser
            ? "linear-gradient(135deg, #4f7aff, #2a3f80)"
            : "linear-gradient(135deg, var(--cognos-surface), var(--cognos-border))",
          border: isUser ? "none" : "1px solid #4f7aff44",
          color: isUser ? "white" : "var(--cognos-accent)",
        }}
      >
        {isUser ? "U" : "C"}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 max-w-[88%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${isUser ? "rounded-tr-sm" : "rounded-tl-sm"}`}
          style={{
            background: isUser
              ? "linear-gradient(135deg, #1e3a8a22, #4f7aff22)"
              : "var(--cognos-surface)",
            border: `1px solid ${isUser ? "#4f7aff33" : "var(--cognos-border)"}`,
          }}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#c7d2fe" }}>
              {content}
            </p>
          ) : (
            <div className="text-sm leading-relaxed cognos-prose" style={{ color: "var(--cognos-text)" }}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Meta row */}
        <div className={`flex items-center gap-2 mt-1 px-1 flex-wrap ${isUser ? "flex-row-reverse" : "flex-row"}`}>
          <span className="text-[11px]" style={{ color: "var(--cognos-faint)" }}>
            {timeStr}
          </span>
          {!isUser && hasTrace && (
            <button
              onClick={() => setShowTrace((v) => !v)}
              className="text-[11px] px-2 py-0.5 rounded-full transition-colors"
              style={{
                color: showTrace ? "var(--cognos-accent)" : "var(--cognos-muted)",
                background: showTrace ? "#4f7aff18" : "transparent",
                border: `1px solid ${showTrace ? "#4f7aff44" : "var(--cognos-border)"}`,
              }}
            >
              ⬡ {showTrace ? "hide council trace" : "council trace"}
            </button>
          )}
          {!isUser && vetoed && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#f59e0b1a", color: "var(--cognos-critic)", border: "1px solid #f59e0b44" }}
            >
              ◆ vetoed
            </span>
          )}
        </div>

        {/* The deliberation itself, beside the answer */}
        {showTrace && hasTrace && (
          <div className="w-full mt-1">
            <CouncilTrace trace={trace!} />
          </div>
        )}
      </div>
    </div>
  );
}
