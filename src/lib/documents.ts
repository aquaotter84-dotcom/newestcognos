import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { chatCompletion } from "./council";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 4;

export type StoredDocument = {
  id: string;
  workspaceId: string;
  name: string;
  contentText: string | null;
  processingStatus: string;
  summary: string | null;
};

export async function getDocumentContext(workspaceId: string): Promise<string> {
  try {
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.workspaceId, workspaceId))
      .limit(20);

    return docs
      .filter((d) => d.processingStatus === "complete" && d.contentText)
      .slice(0, 6)
      .map((d) => {
        const summary = d.summary || d.analysis;
        const preview = (d.contentText || "").slice(0, 500);
        return `Document: ${d.name}\n${summary ? `Summary: ${summary}\n` : ""}Excerpt: ${preview}`;
      })
      .join("\n\n");
  } catch {
    return "";
  }
}

export async function analyzeDocument(
  docId: string,
  name: string,
  contentText: string
): Promise<{ summary: string; analysis: string } | null> {
  if (!contentText.trim()) return null;
  try {
    const raw = await chatCompletion(
      [
        {
          role: "system",
          content:
            'You are a document analyst for COGNOS. Given a document name and its text, produce a concise summary and a short analysis that is useful as context for the council. Return JSON with "summary" and "analysis" strings. Keep both under ~150 words.',
        },
        {
          role: "user",
          content: `Document: ${name}\n\nText (${contentText.length.toLocaleString()} chars):\n${contentText.slice(0, 12000)}`,
        },
      ],
      { maxTokens: 700, temperature: 0.3 }
    );

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const json = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(json) as { summary?: string; analysis?: string };
    return {
      summary: String(parsed.summary || "").trim() || name,
      analysis: String(parsed.analysis || "").trim() || "",
    };
  } catch {
    return {
      summary: name,
      analysis: "Automatic analysis was not available for this document.",
    };
  }
}

/**
 * SSRF guard: only http(s) URLs, resolved to a public address before
 * fetching. Blocks loopback, private, link-local, CGNAT, and benchmark
 * ranges (IPv4 + IPv6). Redirects are re-checked hop by hop.
 */
async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs can be fetched");
  }
  const { address } = await lookup(url.hostname, { verbatim: true });
  if (isBlockedAddress(address)) {
    throw new Error("Refusing to fetch a private or local address");
  }
  return url;
}

function isBlockedAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
    return false;
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower.startsWith("::ffff:127.")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (/^fe[89ab]/.test(lower)) return true; // link-local
    return false;
  }
  return true; // not a valid IP: don't fetch it
}

export async function fetchTextFromUrl(
  fileUrl: string,
  mimeType?: string | null
): Promise<{ text: string; detectedType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = await assertSafeUrl(fileUrl);
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await fetch(current, { redirect: "manual", signal: controller.signal });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error(`Redirect from ${current} has no location`);
        current = await assertSafeUrl(new URL(loc, current).toString());
        continue;
      }
      break;
    }
    if (!res || !res.ok) {
      throw new Error(`Failed to fetch ${fileUrl} (${res?.status ?? "no response"})`);
    }
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > MAX_DOCUMENT_BYTES) {
      throw new Error(
        `Document too large (${declared} bytes; limit ${MAX_DOCUMENT_BYTES})`
      );
    }
    const blob = await res.blob();
    const bytes = await blob.arrayBuffer();
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
      throw new Error(
        `Document too large (${bytes.byteLength} bytes; limit ${MAX_DOCUMENT_BYTES})`
      );
    }
    const type = mimeType || blob.type || "";

    if (type.includes("pdf") || fileUrl.toLowerCase().endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(Buffer.from(bytes));
      return { text: parsed.text || "", detectedType: "pdf" };
    }

    const text = new TextDecoder("utf-8").decode(bytes);
    return { text, detectedType: type || "text" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function classifyDocument(
  name: string,
  mimeType?: string | null,
  source?: string
): Promise<string> {
  const label = name.toLowerCase();
  if (label.includes("sheet") || label.includes("csv")) return "spreadsheet";
  if (label.includes("slide") || label.includes("ppt")) return "slides";
  if (label.includes("image") || ["image/png", "image/jpeg", "image/webp"].includes((mimeType || "").toLowerCase())) return "image";
  if (label.includes("pdf")) return "pdf";
  if (source === "drive") return "google_drive";
  return "document";
}
