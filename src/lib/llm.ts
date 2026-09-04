// Thin OpenAI-compatible chat client for the council.
//
// Stack contract (do not loosen):
//   endpoint: https://api.bluesminds.com/v1/chat/completions
//   key:      BLUESMINDS_API_KEY
//   model:    BLUESMINDS_MODEL, default "gpt-4o-mini"
//            (NOT gpt_5_4 — that model has upstream 503s; gpt-4o-mini is
//            verified working)
//   we NEVER send a response_format parameter — it breaks provider
//            compatibility. JSON structure is enforced by the prompts and
//            recovered by extractJson().
//   (internal only: BLUESMINDS_API_URL may point the client at a local mock
//    for tests — never documented, never relied on in deployment)

const DEFAULT_API_URL = "https://api.bluesminds.com/v1/chat/completions";
export const DEFAULT_MODEL = "gpt-4o-mini";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function activeModel(): string {
  return process.env.BLUESMINDS_MODEL || DEFAULT_MODEL;
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const apiKey = process.env.BLUESMINDS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BLUESMINDS_API_KEY is not set. Add it to your environment (or Vercel settings) and retry."
    );
  }

  const apiUrl = process.env.BLUESMINDS_API_URL || DEFAULT_API_URL;

  const body: Record<string, unknown> = {
    model: opts.model || activeModel(),
    messages,
    max_tokens: opts.maxTokens ?? 600,
    temperature: opts.temperature ?? 0.4,
  };
  // Note: no response_format on purpose — see the contract above.

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Council model request failed (${res.status})${
        detail ? `: ${detail.slice(0, 240)}` : ""
      }`
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data?.choices?.[0]?.message?.content ?? "";
}

/**
 * Tolerant JSON recovery. The model is asked for a JSON object but may wrap
 * it in prose or code fences; without response_format we must dig it out.
 * Order: strict parse → outermost braces → markdown fence. Returns null when
 * nothing parses — callers decide how to degrade (usually: use the raw text).
 */
export function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const trimmed = text.trim();

  const tryParse = (candidate: string): Record<string, unknown> | null => {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
    return null;
  };

  const strict = tryParse(trimmed);
  if (strict) return strict;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const braced = tryParse(trimmed.slice(start, end + 1));
    if (braced) return braced;
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    const fenced = tryParse(fence[1].trim());
    if (fenced) return fenced;
  }

  return null;
}
