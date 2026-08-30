import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { chatCompletion } from "./council";

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

export async function fetchTextFromUrl(
  fileUrl: string,
  mimeType?: string | null
): Promise<{ text: string; detectedType: string }> {
  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${fileUrl} (${res.status})`);
  }
  const blob = await res.blob();
  const type = mimeType || blob.type || "";
  const bytes = await blob.arrayBuffer();

  if (type.includes("pdf") || fileUrl.toLowerCase().endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(Buffer.from(bytes));
    return { text: parsed.text || "", detectedType: "pdf" };
  }

  const text = new TextDecoder("utf-8").decode(bytes);
  return { text, detectedType: type || "text" };
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
