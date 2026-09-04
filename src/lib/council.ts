// The council deliberation pipeline — the core intelligence of COGNOS.
//
// One user message produces one CouncilTrace:
//   Observer → Strategist → Specialist → Synthesizer → Critic
//   (bounded revision loop) → Governor (real veto).
//
// Sovereign principle: when the Governor withholds approval, the council's
// draft is NEVER released — only the Governor's own directive, or an
// explicit refusal. Silence beats a false answer.

import {
  COGNOS_IDENTITY,
  OPERATOR_PROMPTS,
  STYLE_INSTRUCTIONS,
  type Style,
} from "./prompts";
import { activeModel, chatCompletion, extractJson, type ChatMessage } from "./llm";

// Council tuning constants (deliberately not environment knobs — the system
// has exactly four documented variables, see .env.example).
const MAX_REVISIONS = 1;
const REVISION_THRESHOLD = 70;

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
    governorVetoed: boolean;
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

function bodyString(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function runOperator(
  operator: keyof typeof OPERATOR_PROMPTS,
  systemContext: string,
  userMessage: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<OperatorOutput> {
  const raw = await chatCompletion(
    [
      { role: "system", content: OPERATOR_PROMPTS[operator] + "\n\n" + systemContext },
      { role: "user", content: userMessage },
    ],
    { maxTokens: opts.maxTokens ?? 500, temperature: opts.temperature ?? 0.4 }
  );

  // When JSON recovery fails, keep the raw text so the trace still shows
  // what this operator actually said.
  const parsed = extractJson(raw) ?? { raw };
  return { operator, output: parsed, raw };
}

export async function runCouncil(
  userMessage: string,
  context: string,
  conversationHistory: Array<{ role: string; content: string }>,
  opts: { model?: string; style?: Style } = {}
): Promise<CouncilTrace> {
  const active = opts.model || activeModel();
  const style: Style = opts.style && STYLE_INSTRUCTIONS[opts.style] ? opts.style : "balanced";
  const maxRevisions = MAX_REVISIONS;
  const revisionThreshold = REVISION_THRESHOLD;

  const historyText =
    conversationHistory.length > 0
      ? "Recent conversation:\n" +
        conversationHistory
          .slice(-8)
          .map((m) => `${m.role === "user" ? "User" : "COGNOS"}: ${m.content}`)
          .join("\n")
      : "";

  const baseContext = [
    COGNOS_IDENTITY,
    `Communication style: ${style}. ${STYLE_INSTRUCTIONS[style]}`,
    context ? `Active memory context:\n${context}` : "",
    historyText,
  ]
    .filter(Boolean)
    .join("\n\n");

  // ── Observer: what is actually there ─────────────────────────────────────
  const observer = await runOperator("observer", baseContext, userMessage, {
    temperature: 0.4,
  });

  // ── Strategist: plan the approach ────────────────────────────────────────
  const strategist = await runOperator(
    "strategist",
    baseContext + `\n\nObserver output:\n${bodyString(observer.output)}`,
    userMessage,
    { temperature: 0.4 }
  );

  // ── Specialist: focused depth ────────────────────────────────────────────
  const specialist = await runOperator(
    "specialist",
    baseContext +
      `\n\nObserver output:\n${bodyString(observer.output)}\n\nStrategist output:\n${bodyString(strategist.output)}`,
    userMessage,
    { temperature: 0.5 }
  );

  // ── Synthesizer: merge into one answer ───────────────────────────────────
  const councilInputs = {
    userMessage,
    observer: observer.output,
    strategist: strategist.output,
    specialist: specialist.output,
  };
  let synthesizer = await runOperator(
    "synthesizer",
    baseContext + `\n\nCouncil inputs:\n${bodyString(councilInputs)}`,
    userMessage,
    { temperature: 0.7, maxTokens: 900 }
  );

  // ── Critic: attack the weak points (+ bounded revision loop) ────────────
  let critic = await runOperator(
    "critic",
    baseContext + `\n\nDraft response:\n${bodyString(synthesizer.output)}`,
    userMessage,
    { temperature: 0.4 }
  );

  let revisionCount = 0;
  let revisionTriggered = false;

  const complexity = String((observer.output.classification as Record<string, unknown> | undefined)?.complexity || "moderate");
  const isSimple = complexity === "simple";
  const path = isSimple ? "direct" : "full";

  // Re-evaluate after EVERY critic pass — stop early once the revised draft
  // clears the threshold; never blindly burn the revision budget.
  const evaluate = (output: Record<string, unknown>) => {
    const evaluation = (output.evaluation || {}) as Record<string, unknown>;
    const score = Number(evaluation.score ?? 0);
    const needsRevision = evaluation.needs_revision === true && !isSimple;
    return { score, needsRevision };
  };

  let verdict = evaluate(critic.output);
  while (
    revisionCount < maxRevisions &&
    verdict.needsRevision &&
    verdict.score < revisionThreshold
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
      baseContext + `\n\nRevised draft:\n${bodyString(synthesizer.output)}`,
      userMessage,
      { temperature: 0.4 }
    );
    verdict = evaluate(critic.output);
  }

  const rawResponse = synthesizer.output.responseText;
  const draftResponse =
    typeof rawResponse === "string" && rawResponse.trim()
      ? rawResponse.trim()
      : String(rawResponse || "").trim() ||
        "I was unable to form a response from the council's synthesis.";

  // ── Governor: real veto power ────────────────────────────────────────────
  const governor = await runOperator(
    "governor",
    baseContext +
      `\n\nCouncil trace:\n${bodyString(synthesizer.output)}\n\nFinal response:\n${draftResponse}`,
    userMessage,
    { temperature: 0.4 }
  );

  // When the Governor withholds approval, honor the Sovereign layer:
  // release only its own directive — or an explicit refusal. Never the
  // draft it declined to stand behind.
  const goveOutput = governor.output as Record<string, unknown>;
  const approved = goveOutput.approved !== false;
  let finalResponse = draftResponse;
  if (!approved) {
    const directive =
      typeof goveOutput.sovereigntyDirective === "string" &&
      goveOutput.sovereigntyDirective.trim()
        ? goveOutput.sovereigntyDirective.trim()
        : "";
    finalResponse =
      directive ||
      "I've chosen not to answer this one. The council's draft didn't meet the bar I'd stand behind.";
  }

  const classification = (observer.output.classification || {}) as Record<string, unknown>;
  const taskTypeValue = (classification.task_type as string) || "conversation";

  return {
    observer: observer.output,
    strategist: strategist.output,
    specialist: specialist.output,
    synthesizer: synthesizer.output,
    critic: critic.output,
    governor: governor.output,
    finalResponse,
    latent: {
      latencyMs: 0, // filled in by the route with measured timing
      modelUsed: active,
      taskType: taskTypeValue,
      revisionCount,
      revisionTriggered,
      governorVetoed: !approved,
      adaptive: { complexity, path },
    },
  };
}

// ─── Post-turn memory work ─────────────────────────────────────────────────

export async function extractMemories(
  userMessage: string,
  responseText: string
): Promise<MemoryExtraction[]> {
  const MEMORY_PROMPT = `You are a memory extraction agent for a personal reasoning engine. Analyze the conversation and extract any important facts, preferences, or information worth remembering for future conversations. Only extract genuinely useful, long-term information — not casual conversation.
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
        const evidenceLevel = ["direct", "repeated", "inferred", "assumed"].includes(
          String(item.evidence_level)
        )
          ? (String(item.evidence_level) as MemoryExtraction["evidence_level"])
          : "inferred";
        const volatility = ["low", "medium", "high"].includes(
          String(item.volatility)
        )
          ? (String(item.volatility) as MemoryExtraction["volatility"])
          : "medium";
        const tier = ["short", "medium", "long", "mythic"].includes(String(item.tier))
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

/** Best-effort rolling summary so threads retain continuity across long runs. */
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
            "Summarize the following conversation in 1-2 concise sentences. Capture what the user wanted and the outcome. Return only JSON: {\"summary\": \"...\"}",
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

export type { ChatMessage };
