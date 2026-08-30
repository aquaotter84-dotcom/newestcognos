"use client";

import { useState, useRef, useEffect } from "react";
import type { DocumentRecord } from "@/types/cognos";
import { useSpeechRecognition } from "@/hooks/use-voice";

type Props = {
  onSend: (
    content: string,
    showTrace: boolean,
    webSearch: boolean,
    attachments: string[]
  ) => void;
  disabled: boolean;
  isProcessing?: boolean;
  onStop?: () => void;
  availableDocuments?: DocumentRecord[];
};

export default function ChatInput({
  onSend,
  disabled,
  isProcessing,
  onStop,
  availableDocuments = [],
}: Props) {
  const [value, setValue] = useState("");
  const [showTrace, setShowTrace] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { supported: micSupported, listening, interim, start, stop } =
    useSpeechRecognition((text) =>
      setValue((prev) => (prev.trim() ? prev.trim() + " " : "") + text)
    );

  const displayText =
    listening && interim ? (value ? value + " " : "") + interim : value;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, showTrace, webSearch, attachments);
    setValue("");
    setAttachments([]);
    setShowAttach(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="px-4 py-3"
      style={{ borderTop: "1px solid #1a1f3a", background: "#05070f" }}
    >
      {/* Input row */}
      <div
        className="flex items-end gap-2 rounded-2xl px-4 py-3 transition-all"
        style={{
          background: "#0c0f1e",
          border: "1px solid #1a1f3a",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#4f7aff44";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#1a1f3a";
        }}
      >
        <textarea
          ref={textareaRef}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? "Listening…" : "Speak to COGNOS…"}
          disabled={disabled || listening}
          rows={1}
          value={displayText}
          className="flex-1 text-sm outline-none resize-none bg-transparent leading-relaxed"
          style={{
            color: "#e2e8f0",
            minHeight: "24px",
            maxHeight: "160px",
          }}
        />
        {micSupported && (
          <button
            onClick={() => (listening ? stop() : start())}
            className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all ${
              listening ? "animate-pulse" : ""
            }`}
            style={{
              background: listening ? "#7f1d1d" : "#1a1f3a",
              color: listening ? "#fecaca" : "#64748b",
            }}
            title={listening ? "Stop listening" : "Speak"}
          >
            {listening ? "◼" : "◉"}
          </button>
        )}
        {isProcessing && onStop ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "#7f1d1d", color: "#fecaca" }}
            title="Stop generating"
          >
            ■
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{
              background:
                value.trim() && !disabled
                  ? "linear-gradient(135deg, #4f7aff, #7c3aed)"
                  : "#1a1f3a",
              color: value.trim() && !disabled ? "white" : "#334155",
            }}
          >
            ↑
          </button>
        )}
      </div>

      {/* Options row */}
      <div className="flex items-center gap-3 mt-2 px-1">
        <button
          onClick={() => setShowTrace(!showTrace)}
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: showTrace ? "#4f7aff" : "#334155" }}
        >
          <span
            className="w-3 h-3 rounded-sm border flex items-center justify-center"
            style={{
              borderColor: showTrace ? "#4f7aff" : "#1e293b",
              background: showTrace ? "#4f7aff" : "transparent",
            }}
          >
            {showTrace && <span className="text-white text-xs leading-none">✓</span>}
          </span>
          Council trace
        </button>
        <span className="text-xs" style={{ color: "#1e293b" }}>•</span>
        <button
          onClick={() => setWebSearch(!webSearch)}
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: webSearch ? "#34d399" : "#334155" }}
        >
          <span
            className="w-3 h-3 rounded-sm border flex items-center justify-center"
            style={{
              borderColor: webSearch ? "#34d399" : "#1e293b",
              background: webSearch ? "#34d399" : "transparent",
            }}
          >
            {webSearch && <span className="text-white text-xs leading-none">✓</span>}
          </span>
          Web search
        </button>
        <span className="text-xs" style={{ color: "#1e293b" }}>•</span>
        <button
          onClick={() => setShowAttach(!showAttach)}
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: showAttach || attachments.length ? "#c7d2fe" : "#334155" }}
        >
          <span
            className="w-3 h-3 rounded-sm border flex items-center justify-center"
            style={{
              borderColor: showAttach || attachments.length ? "#c7d2fe" : "#1e293b",
              background: showAttach || attachments.length ? "#1e3a5f" : "transparent",
            }}
          >
            {attachments.length > 0 && (
              <span className="text-white text-[9px] leading-none">{attachments.length}</span>
            )}
          </span>
          Attach
        </button>
        <span className="text-xs" style={{ color: "#1e293b" }}>•</span>
        <span className="text-xs" style={{ color: "#1e293b" }}>
          Shift+Enter for newline
        </span>
        <span className="ml-auto text-xs" style={{ color: "#1e293b" }}>
          One Voice. Many Minds.
        </span>
      </div>

      {showAttach && (
        <div className="mt-2 rounded-xl p-3" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
          <div className="text-xs mb-2" style={{ color: "#475569" }}>
            Reference documents for this message
          </div>
          {availableDocuments.length === 0 ? (
            <div className="text-xs" style={{ color: "#334155" }}>
              Add documents in the Documents module first.
            </div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {availableDocuments.map((doc) => {
                const active = attachments.includes(doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() =>
                      setAttachments((prev) =>
                        active ? prev.filter((x) => x !== doc.id) : [...prev, doc.id]
                      )
                    }
                    className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg text-left"
                    style={{
                      background: active ? "#4f7aff18" : "#080b18",
                      border: `1px solid ${active ? "#4f7aff44" : "#1a1f3a"}`,
                      color: active ? "#c7d2fe" : "#64748b",
                    }}
                  >
                    <span>{active ? "✓" : "○"}</span>
                    <span className="truncate flex-1">{doc.name}</span>
                    <span style={{ color: "#334155" }}>{doc.category}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
