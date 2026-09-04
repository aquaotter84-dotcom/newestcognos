"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onSend: (content: string) => void;
  isProcessing: boolean;
  onStop: () => void;
};

export default function ChatInput({ onSend, isProcessing, onStop }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea up to ~5 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [value]);

  const submit = () => {
    const content = value.trim();
    if (!content || isProcessing) return;
    setValue("");
    onSend(content);
  };

  return (
    <div
      className="px-3 pt-2 safe-bottom flex-shrink-0"
      style={{ borderTop: "1px solid var(--cognos-border)", background: "var(--cognos-bg)" }}
    >
      <div
        className="flex items-end gap-2 rounded-2xl p-2"
        style={{ background: "var(--cognos-surface)", border: "1px solid var(--cognos-border)" }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask the council…"
          className="flex-1 bg-transparent resize-none outline-none text-sm py-1.5 leading-relaxed max-h-[140px]"
          style={{ color: "var(--cognos-text)" }}
        />

        {isProcessing ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors flex-shrink-0"
            style={{ background: "#7f1d1d33", border: "1px solid #7f1d1d66", color: "#fca5a5" }}
            title="Stop the deliberation"
          >
            <span className="w-2 h-2 rounded-sm" style={{ background: "#fca5a5" }} />
            Stop
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0 disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #1e3a8a55, #4f7aff44)",
              border: "1px solid #4f7aff55",
              color: "#93c5fd",
            }}
          >
            Send ↑
          </button>
        )}
      </div>
      <p className="text-[10px] mt-1.5 px-1" style={{ color: "var(--cognos-faint)" }}>
        The council deliberates before answering — the Governor can veto a false answer.
      </p>
    </div>
  );
}
