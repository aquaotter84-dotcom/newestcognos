"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useCognos } from "@/lib/cognos-context";
import type { DocumentRecord } from "@/types/cognos";

type Source = "text" | "url" | "upload";

export default function DocumentsPage() {
  const { activeWorkspace, sessions } = useCognos();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [source, setSource] = useState<Source>("text");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/documents?workspaceId=${activeWorkspace.id}`);
      const data = await res.json().catch(() => []);
      setDocuments(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFile = async (file: File) => {
    if (!file) return;
    setName((prev) => prev || file.name);
    try {
      const text = await file.text();
      setContent(text);
      if (text.trim()) {
        setSource("text");
      } else {
        setSource("upload");
      }
    } catch {
      setSource("upload");
    }
  };

  const create = async () => {
    if (!activeWorkspace) return;
    setError(null);
    if (source === "url" && !fileUrl.trim()) {
      setError("Enter a document URL");
      return;
    }
    if (source === "text" && !content.trim()) {
      setError("Paste or type the document content");
      return;
    }
    setProcessing(true);
    try {
      const body: Record<string, unknown> = {
        workspaceId: activeWorkspace.id,
        name: name.trim() || (source === "url" ? "Linked document" : "Past text"),
        source: source === "url" ? "url" : "text",
        sessionId: sessionId || undefined,
      };
      if (source === "url") {
        body.fileUrl = fileUrl.trim();
      } else {
        body.contentText = content;
      }
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create document");
      setDocuments((prev) => [data, ...prev]);
      setName("");
      setContent("");
      setFileUrl("");
      setSessionId("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create document");
    } finally {
      setProcessing(false);
      if (source === "upload") setSource("text");
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setConfirmId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Documents"
        subtitle="Files, URLs, and pasted content available to the council"
        actions={
          <button
            onClick={() => setAdding((v) => !v)}
            className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ background: "#4f7aff", color: "white" }}
          >
            + Add document
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div
            className="max-w-3xl mx-auto mb-3 text-sm px-4 py-2 rounded-xl"
            style={{ background: "#1a0505", border: "1px solid #7f1d1d44", color: "#fca5a5" }}
          >
            {error}
          </div>
        )}

        {adding && (
          <div
            className="max-w-3xl mx-auto rounded-2xl p-4 mb-5 space-y-3"
            style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}
          >
            <div className="flex gap-2">
              {(["text", "url", "upload"] as Source[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg capitalize"
                  style={{
                    background: source === s ? "#4f7aff22" : "#1a1f3a",
                    color: source === s ? "#4f7aff" : "#64748b",
                    border: `1px solid ${source === s ? "#4f7aff44" : "#1a1f3a"}`,
                  }}
                >
                  {s === "upload" ? "File" : s}
                </button>
              ))}
            </div>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Document name"
              className="w-full text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
            />

            {source === "text" && (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste the document text (or excerpt) here"
                rows={6}
                className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none"
                style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
              />
            )}
            {source === "url" && (
              <input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://… (text, markdown, or PDF source)"
                className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
              />
            )}
            {source === "upload" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-sm px-3 py-3 rounded-lg"
                  style={{ background: "#080b18", border: "1px dashed #1a1f3a", color: "#64748b" }}
                >
                  Choose a text/markdown file (CSV, MD, TXT, JSON)
                </button>
                {content && (
                  <div className="text-xs" style={{ color: "#34d399" }}>
                    Loaded {content.length.toLocaleString()} characters
                  </div>
                )}
              </>
            )}

            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
            >
              <option value="">Attach to session: none</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>

            <button
              onClick={create}
              disabled={processing}
              className="w-full text-sm font-medium py-2 rounded-lg"
              style={{
                background: processing ? "#1a1f3a" : "#4f7aff",
                color: processing ? "#64748b" : "white",
              }}
            >
              {processing ? "Processing…" : "Add document"}
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: "#475569" }}>Loading…</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16" style={{ color: "#475569" }}>
            <div className="text-4xl mb-3" style={{ color: "#4f7aff" }}>▥</div>
            <div className="text-sm">No documents yet</div>
            <div className="text-xs mt-1">Add a file, URL, or pasted text to give the council reference material.</div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-xl p-4"
                style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: "#c7d2fe" }}>
                      {doc.name}
                    </div>
                    <div className="text-xs mt-1 flex gap-2 flex-wrap" style={{ color: "#475569" }}>
                      <span>{doc.category}</span>
                      <span>source: {doc.source}</span>
                      <span
                        className="px-1.5 rounded"
                        style={{
                          background:
                            doc.processingStatus === "complete"
                              ? "#34d39918"
                              : doc.processingStatus === "error"
                                ? "#f43f5e18"
                                : "#f59e0b18",
                          color:
                            doc.processingStatus === "complete"
                              ? "#34d399"
                              : doc.processingStatus === "error"
                                ? "#f43f5e"
                                : "#f59e0b",
                        }}
                      >
                        {doc.processingStatus}
                      </span>
                    </div>
                    {doc.summary && (
                      <div className="text-xs mt-3" style={{ color: "#94a3b8" }}>
                        <span style={{ color: "#4f7aff" }}>Summary:</span> {doc.summary}
                      </div>
                    )}
                    {doc.analysis && (
                      <div className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "#64748b" }}>
                        {doc.analysis}
                      </div>
                    )}
                    {doc.errorMessage && (
                      <div className="text-xs mt-2" style={{ color: "#fca5a5" }}>{doc.errorMessage}</div>
                    )}
                    {doc.contentText && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer" style={{ color: "#475569" }}>
                          View extracted text ({doc.contentText.length.toLocaleString()} chars)
                        </summary>
                        <pre
                          className="mt-2 text-xs whitespace-pre-wrap max-h-64 overflow-y-auto p-3 rounded-lg"
                          style={{ background: "#080b18", color: "#64748b", border: "1px solid #1a1f3a" }}
                        >
                          {doc.contentText.slice(0, 12000)}
                        </pre>
                      </details>
                    )}
                  </div>
                  {confirmId === doc.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => remove(doc.id)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "#7f1d1d", color: "#fecaca" }}>Yes</button>
                      <button onClick={() => setConfirmId(null)} className="text-xs px-2 py-1 rounded-lg" style={{ background: "#1a1f3a", color: "#64748b" }}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(doc.id)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "#64748b" }}>✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
