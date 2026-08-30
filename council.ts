import { OPERATOR_PROMPTS, COUNCIL_ORDER } from "./cognos-prompts";

export type OperatorOutput = {
  operator: (typeof COUNCIL_ORDER)[number];
  output: Record<string, unknown>;
  raw: string;
};

export type CouncilTrace = {
  observer: Record<string, unknown>;
  strategist: Record<string, unknown>;
  critic: Record<string, unknown>;
  governor: Record<string, unknown>;
  finalResponse: string;
};

const DEFAULT_API_URL = "https://api.bluesminds.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt_5_4";

type ChatMessage = { role: string; content: string };

async function chatCompletion(
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number; temperature?: number }
): Promise<string> {
  const apiKey = process.env.BLUESMINDS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BLUESMINDS_API_KEY is not set. Add it to your environment variables."
    );
  }

  const apiUrl = process.env.BLUESMINDS_API_URL || DEFAULT_API_URL;
  const model = opts.model || process.env.BLUESMINDS_MODEL || DEFAULT_MODEL;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 400,
      temperature: opts.temperature ?? 0.4,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `BluesMinds request failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
    );
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function runOperator(
  operator: (typeof COUNCIL_ORDER)[number],
  systemContext: string,
  userMessage: string,
  model: string
): Promise<OperatorOutput> {
  const systemPrompt = OPERATOR_PROMPTS[operator];

  const raw = await chatCompletion(
    [
      {
        role: "system",
        content: systemPrompt + "\n\n" + systemContext,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    { model, maxTokens: 400, temperature: 0.4 }
  );

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { raw };
  }

  return { operator, output: parsed, raw };
}

export async function runCouncil(
  userMessage: string,
  memoryContext: string,
  conversationHistory: Array<{ role: string; content: string }>,
  model?: string
): Promise<CouncilTrace> {
  const activeModel = model || process.env.BLUESMINDS_MODEL || DEFAULT_MODEL;

  const historyText =
    conversationHistory.length > 0
      ? "Recent conversation:\n" +
        conversationHistory
          .slice(-6)
          .map((m) => `${m.role === "user" ? "User" : "COGNOS"}: ${m.content}`)
          .join("\n")
      : "";

  const baseContext = [
    memoryContext ? `Active memory context:\n${memoryContext}` : "",
    historyText,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Observer
  const observerResult = await runOperator(
    "observer",
    baseContext,
    userMessage,
    activeModel
  );

  // Strategist
  const strategistResult = await runOperator(
    "strategist",
    baseContext +
      `\n\nObserver output:\n${JSON.stringify(observerResult.output, null, 2)}`,
    userMessage,
    activeModel
  );

  // Critic
  const criticResult = await runOperator(
    "critic",
    baseContext +
      `\n\nObserver output:\n${JSON.stringify(observerResult.output, null, 2)}\n\nStrategist output:\n${JSON.stringify(strategistResult.output, null, 2)}`,
    userMessage,
    activeModel
  );

  // Governor
  const governorResult = await runOperator(
    "governor",
    baseContext +
      `\n\nObserver:\n${JSON.stringify(observerResult.output, null, 2)}\n\nStrategist:\n${JSON.stringify(strategistResult.output, null, 2)}\n\nCritic:\n${JSON.stringify(criticResult.output, null, 2)}`,
    userMessage,
    activeModel
  );

  // Orchestrator — final unified response
  const orchestratorContext = `Council trace:

Observer (Guidance):
${JSON.stringify(observerResult.output, null, 2)}

Strategist (Navigation):
${JSON.stringify(strategistResult.output, null, 2)}

Critic (Oversight):
${JSON.stringify(criticResult.output, null, 2)}

Governor (Sovereignty):
${JSON.stringify(governorResult.output, null, 2)}

${baseContext}`;

  const finalResponse = await chatCompletion(
    [
      {
        role: "system",
        content: OPERATOR_PROMPTS.orchestrator + "\n\n" + orchestratorContext,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    { model: activeModel, maxTokens: 800, temperature: 0.7 }
  );

  return {
    observer: observerResult.output,
    strategist: strategistResult.output,
    critic: criticResult.output,
    governor: governorResult.output,
    finalResponse:
      finalResponse || "I was unable to respond.",
  };
}
