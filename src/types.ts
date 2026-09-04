// Shared shapes for the client. The server is the source of truth; these
// mirror what the API returns.

export type Session = {
  id: string;
  title: string;
  summary: string | null;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
};

export type WebSearchOutput = {
  query: string;
  provider: string;
  results: Array<{ title: string; url: string; snippet: string }>;
  error?: string;
};

export type CouncilTrace = {
  observer: Record<string, unknown>;
  strategist: Record<string, unknown>;
  specialist: Record<string, unknown> | null;
  synthesizer: Record<string, unknown> | null;
  critic: Record<string, unknown>;
  governor: Record<string, unknown>;
  finalResponse: string;
  latent?: {
    latencyMs?: number;
    modelUsed?: string;
    taskType?: string;
    revisionCount?: number;
    revisionTriggered?: boolean;
    governorVetoed?: boolean;
    adaptive?: { complexity?: string; path?: string };
  };
};

export type Message = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  modelUsed: string | null;
  councilTrace: CouncilTrace | null;
  createdAt: string;
};

export type Memory = {
  id: string;
  tier: "short" | "medium" | "long" | "mythic";
  memoryType: "working" | "episodic" | "semantic";
  key: string;
  value: string;
  importance: number;
  evidenceLevel: "direct" | "repeated" | "inferred" | "assumed";
  volatility: "low" | "medium" | "high";
  isEnabled: boolean;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Council display metadata (kept stable — it is the product's visual
//     language) ─────────────────────────────────────────────────────────────

export type OperatorKey =
  | "observer"
  | "strategist"
  | "specialist"
  | "synthesizer"
  | "critic"
  | "governor";

export const OPERATOR_META: Record<
  OperatorKey,
  { label: string; role: string; layer: string; color: string; icon: string }
> = {
  observer: {
    label: "Observer",
    role: "sees what is actually there",
    layer: "Guidance",
    color: "#38bdf8",
    icon: "◎",
  },
  strategist: {
    label: "Strategist",
    role: "plans the approach",
    layer: "Navigation",
    color: "#a78bfa",
    icon: "◈",
  },
  specialist: {
    label: "Specialist",
    role: "brings focused depth",
    layer: "Execution",
    color: "#f472b6",
    icon: "✳",
  },
  synthesizer: {
    label: "Synthesizer",
    role: "merges the views into one answer",
    layer: "Integration",
    color: "#4f7aff",
    icon: "⬡",
  },
  critic: {
    label: "Critic",
    role: "attacks the weak points",
    layer: "Oversight",
    color: "#f59e0b",
    icon: "◉",
  },
  governor: {
    label: "Governor",
    role: "holds veto over the final answer",
    layer: "Sovereignty",
    color: "#34d399",
    icon: "◆",
  },
};

export const OPERATOR_ORDER: OperatorKey[] = [
  "observer",
  "strategist",
  "specialist",
  "synthesizer",
  "critic",
  "governor",
];

export const TIER_META: Record<Memory["tier"], { label: string; color: string }> = {
  short: { label: "Short-term", color: "#64748b" },
  medium: { label: "Medium-term", color: "#4f7aff" },
  long: { label: "Long-term", color: "#a78bfa" },
  mythic: { label: "Mythic", color: "#f59e0b" },
};

export const EVIDENCE_META: Record<Memory["evidenceLevel"], { label: string; color: string }> = {
  direct: { label: "Direct", color: "#34d399" },
  repeated: { label: "Repeated", color: "#4f7aff" },
  inferred: { label: "Inferred", color: "#f59e0b" },
  assumed: { label: "Assumed", color: "#f43f5e" },
};

export const VOLATILITY_META: Record<Memory["volatility"], { label: string; color: string }> = {
  low: { label: "Low", color: "#34d399" },
  medium: { label: "Medium", color: "#f59e0b" },
  high: { label: "High", color: "#f43f5e" },
};
