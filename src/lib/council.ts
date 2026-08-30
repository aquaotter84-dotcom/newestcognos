import {
  OPERATOR_PROMPTS,
  STYLE_INSTRUCTIONS,
  type Style,
} from "./cognos-prompts";

export type OperatorOutput = {
  operator: string;
  output: Record<string, unknown>;
  raw: string;
};

export type CouncilTrace = {
  observer: Record<string, unknown>;
  strategist: Record<string, unknown>;
  specialist: Record<string, unknown> | null;
  synthesizer: Record<string, unknown> | null;
  critic: Record<string, unknown>;
  governor: Record<string, unknown>;
  finalResponse: string;
  latent: {
    latencyMs: number;
    modelUsed: string;
    taskType: string;
    revisionCount: number;
    revisionTriggered: boolean;
    adaptive: { complexity: string; path: string };
  };
};

export type MemoryExtraction = {
  content: string;
  memory_type: "working" | "episodic" | "semantic";
  importance: number;
  evidence_level: "direct" | "repeated" | "inferred" | "assumed";
  volatility: "low" | "medium" | "high";
  tier: "short" | "medium" | "long" | "mythic";
};

const DEFAULT_API_URL = "https://api.bluesminds.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt_5_4";

type ChatMessage = { role: string; content: string };

function modelName() {
  return process.env.BLUESMINDS_MODEL || DEFAULT_MODEL;
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    responseJson?: boolean;
  } = {}
): Promise<string> {
  const apiKey = process.env.BLUESMINDS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BLUESMINDS_API_KEY is not set. Add it to your environment variables."
    );
  }

  const apiUrl = process.env.BLUESMINDS_API_URL || DEFAULT_API_URL;
  const model = opts.model || modelName();

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.4,
      response_format: opts.responseJson
        ? { type: "json_object" }
        : undefined,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `BluesMinds request failed (${res.status})${
        detail ? `: ${detail.slice(0, 240)}` : ""
      }`
    );
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through to bracket extraction
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }

  // Last resort: capture any JSON-ish block inside markdown fences.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      const parsed = JSON.parse(fence[1].trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function runOperator(
  operator: string,
  systemContext: string,
  userMessage: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<OperatorOutput> {
  const systemPrompt =
    OPERATOR_PROMPTS[operator as keyof typeof OPERATOR_PROMPTS] ||
    OPERATOR_PROMPTS.observer;

  const raw = await chatCompletion(
    [
      {
        role: "system",
        content: systemPrompt + "\n\n" + systemContext,
      },
      { role: "user", content: userMessage },
    ],
    { maxTokens: opts.maxTokens ?? 500, temperature: opts.temperature ?? 0.4 }
  );

  const parsed = extractJson(raw) ?? { raw };
  return { operator, output: parsed, raw };
}

function bodyString(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export async function runCouncil(
  userMessage: string,
  memoryContext: string,
  conversationHistory: Array<{ role: string; content: string }>,
  opts: { model?: string; style?: Style; maxRevisions?: number } = {}
): Promise<CouncilTrace> {
  const activeModel = opts.model || modelName();
  const style = opts.style || "balanced";
  const maxRevisions = opts.maxRevisions ?? Number(process.env.COUNCIL_MAX_REVISIONS || 1);

  const historyText =
    conversationHistory.length > 0
      ? "Recent conversation:\n" +
        conversationHistory
          .slice(-8)
          .map((m) => `${m.role === "user" ? "User" : "COGNOS"}: ${m.content}`)
          .join("\n")
      : "";

  const baseContext = [
    `Communication style: ${style}. ${STYLE_INSTRUCTIONS[style]}`,
    memoryContext ? `Active memory context:\n${memoryContext}` : "",
    historyText,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Observer
  const observer = await runOperator("observer", baseContext, userMessage, {
    temperature: 0.4,
  });

  // Strategist
  const strategist = await runOperator(
    "strategist",
    baseContext +
      `\n\nObserver output:\n${bodyString(observer.output)}`,
    userMessage,
    { temperature: 0.4 }
  );

  // Specialist
  const specialist = await runOperator(
    "specialist",
    baseContext +
      `\n\nObserver output:\n${bodyString(observer.output)}\n\nStrategist output:\n${bodyString(strategist.output)}`,
    userMessage,
    { temperature: 0.5 }
  );

  // Initial synthesis
  const synthesizerInput = {
    userMessage,
    observer: observer.output,
    strategist: strategist.output,
    specialist: specialist.output,
  };
  let synthesizer = await runOperator(
    "synthesizer",
    baseContext +
      `\n\nCouncil inputs:\n${bodyString(synthesizerInput)}`,
    userMessage,
    { temperature: 0.7, maxTokens: 900 }
  );

  const classification = (observer.output.classification || {}) as Record<
    string,
    unknown
  >;
  const complexity = String(classification.complexity || "moderate");
  const isSimple = complexity === "simple";
  const path = isSimple ? "direct" : "full";

  // Critic + revision loop (simple tasks skip revisions)
  let critic = await runOperator(
    "critic",
    baseContext +
      `\n\nDraft response:\n${bodyString(synthesizer.output)}`,
    userMessage,
    { temperature: 0.4 }
  );
  let revisionCount = 0;
  let revisionTriggered = false;

  const evaluator = (critic.output.evaluation || {}) as Record<string, unknown>;
  const score = Number(evaluator.score ?? 0);
  const needsRevision = evaluator.needs_revision === true && !isSimple;

  while (
    maxRevisions > 0 &&
    revisionCount < maxRevisions &&
    needsRevision &&
    score < Number(evaluator.revisionThreshold ?? (process.env.COUNCIL_REVISION_THRESHOLD || 70))
  ) {
    revisionTriggered = true;
    revisionCount++;
    synthesizer = await runOperator(
      "synthesizer",
      baseContext +
        `\n\nPrevious draft:\n${bodyString(synthesizer.output)}\n\nCritic feedback:\n${bodyString(critic.output)}`,
      userMessage,
      { temperature: 0.7, maxTokens: 900 }
    );
    critic = await runOperator(
      "critic",
      baseContext +
        `\n\nRevised draft:\n${bodyString(synthesizer.output)}`,
      userMessage,
      { temperature: 0.4 }
    );
  }

  const rawResponse = synthesizer.output.responseText;
  const finalResponse =
    typeof rawResponse === "string" && rawResponse.trim()
      ? rawResponse.trim()
      : String(rawResponse || "").trim() ||
        "I was unable to form a response from the council's synthesis.";

  const governor = await runOperator(
    "governor",
    baseContext +
      `\n\nCouncil trace:\n${bodyString(synthesizer.output)}\n\nFinal response:\n${finalResponse}`,
    userMessage,
    { temperature: 0.4 }
  );

  const goveOutput = governor.output as Record<string, unknown>;
  const approved = goveOutput.approved !== false;
  const releasedFinal = approved ? finalResponse : finalResponse;

  const taskTypeValue =
    (classification.task_type as string) || "conversation";
  const latencyMs = 0; // filled by the route with measured timing

  return {
    observer: observer.output,
    strategist: strategist.output,
    specialist: specialist.output,
    synthesizer: synthesizer.output,
    critic: critic.output,
    governor: governor.output,
    finalResponse: releasedFinal,
    latent: {
      latencyMs,
      modelUsed: activeModel,
      taskType: taskTypeValue,
      revisionCount,
      revisionTriggered,
      adaptive: { complexity, path },
    },
  };
}

export async function extractMemories(
  userMessage: string,
  responseText: string
): Promise<MemoryExtraction[]> {
  const MEMORY_PROMPT = `You are a memory extraction agent. Analyze the conversation and extract any important facts, preferences, or information worth remembering for future conversations. Only extract genuinely useful, long-term information — not casual conversation.
For each memory:
- content: the fact or preference, as a single sentence
- memory_type: "working" (temporary), "episodic" (an event), or "semantic" (stable knowledge)
- importance: 1-10 integer
- evidence_level: "direct" (explicitly stated), "repeated" (across exchanges), "inferred" (deduced), or "assumed" (guessed, use sparingly)
- volatility: "low" (stable identity/facts), "medium" (preferences/projects), or "high" (in-progress state)
- tier: "short"|"medium"|"long"|"mythic"
Return a JSON object: { "memories": [ ... ] }. Return an empty array if nothing is worth remembering.`;

  try {
    const raw = await chatCompletion(
      [
        { role: "system", content: MEMORY_PROMPT },
        {
          role: "user",
          content: `User: ${userMessage}\nAssistant: ${responseText}`,
        },
      ],
      { maxTokens: 700, temperature: 0.3 }
    );
    const parsed = extractJson(raw);
    const list = parsed?.memories;
    if (!Array.isArray(list)) return [];

    return list
      .map((m) => {
        const item = (m || {}) as Record<string, unknown>;
        const content = String(item.content || "").trim();
        if (!content || content.length < 5) return null;
        const memoryType = ["working", "episodic", "semantic"].includes(
          String(item.memory_type)
        )
          ? (String(item.memory_type) as MemoryExtraction["memory_type"])
          : "semantic";
        const importance = Math.max(1, Math.min(10, Number(item.importance || 5)));
        const evidenceLevel = [
          "direct",
          "repeated",
          "inferred",
          "assumed",
        ].includes(String(item.evidence_level))
          ? (String(item.evidence_level) as MemoryExtraction["evidence_level"])
          : "inferred";
        const volatility = ["low", "medium", "high"].includes(
          String(item.volatility)
        )
          ? (String(item.volatility) as MemoryExtraction["volatility"])
          : "medium";
        const tier = ["short", "medium", "long", "mythic"].includes(
          String(item.tier)
        )
          ? (String(item.tier) as MemoryExtraction["tier"])
          : "medium";
        return {
          content,
          memory_type: memoryType,
          importance,
          evidence_level: evidenceLevel,
          volatility,
          tier,
        };
      })
      .filter((x): x is MemoryExtraction => x !== null);
  } catch {
    return [];
  }
}

export async function summarizeConversation(
  history: Array<{ role: string; content: string }>,
  userMessage: string,
  responseText: string
): Promise<string | null> {
  try {
    const transcript = [
      ...history.map((m) => `${m.role}: ${m.content}`),
      `user: ${userMessage}`,
      `assistant: ${responseText}`,
    ].join("\n");
    const raw = await chatCompletion(
      [
        {
          role: "system",
          content:
            'Summarize the following conversation in 1-2 concise sentences. Capture what the user wanted and the outcome. Return only JSON: {"summary": "..."}',
        },
        { role: "user", content: transcript },
      ],
      { maxTokens: 160, temperature: 0.3 }
    );
    const parsed = extractJson(raw);
    const summary = String(parsed?.summary || "").trim();
    return summary || null;
  } catch {
    return null;
  }
}
