export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  color: string;
  icon: string;
  isDefault: boolean;
  memberEmails: string[] | null;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  id: string;
  workspaceId: string;
  title: string;
  summary: string | null;
  lastMessagePreview: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Attachment = {
  name: string;
  file_url: string;
  file_type: string;
};

export type Message = {
  id: string;
  sessionId: string;
  workspaceId: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelUsed?: string | null;
  taskType?: string | null;
  attachments?: Attachment[] | null;
  processingStatus?: "pending" | "processing" | "complete" | "error";
  councilTrace: CouncilTrace | null;
  createdAt: string;
};

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchOutput = {
  query: string;
  provider: string;
  results: WebSearchResult[];
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
    adaptive?: { complexity?: string; path?: string };
    webSearch?: WebSearchOutput | null;
  };
};

export type Memory = {
  id: string;
  workspaceId: string;
  sessionId: string | null;
  tier: "short" | "medium" | "long" | "mythic";
  memoryType: "working" | "episodic" | "semantic";
  operator: string;
  key: string;
  value: string;
  importance: number;
  relevanceScore: number;
  evidenceLevel: "direct" | "repeated" | "inferred" | "assumed";
  volatility: "low" | "medium" | "high";
  isEnabled: boolean;
  source: string | null;
  sharedWorkspaceIds?: string[] | null;
  lastConfirmed: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

export type DocumentRecord = {
  id: string;
  workspaceId: string;
  sessionId: string | null;
  name: string;
  source: string;
  fileUrl: string | null;
  fileType: string | null;
  mimeType: string | null;
  category: string;
  contentText: string | null;
  summary: string | null;
  analysis: string | null;
  processingStatus: "pending" | "processing" | "complete" | "error";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Insight = {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  triggerType: string;
  topic: string | null;
  taskType: string | null;
  modelUsed: string | null;
  council: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
};

export type ActivityEvent = {
  id: string;
  workspaceId: string;
  sessionId: string | null;
  description: string | null;
  eventType: string;
  agentType: string | null;
  modelUsed: string | null;
  taskType: string | null;
  tokenCount: number;
  latencyMs: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

export type OperatorKey =
  | "observer"
  | "strategist"
  | "specialist"
  | "synthesizer"
  | "critic"
  | "governor";

export const OPERATOR_META: Record<
  OperatorKey,
  { label: string; layer: string; color: string; icon: string }
> = {
  observer: {
    label: "Observer",
    layer: "Guidance",
    color: "#38bdf8",
    icon: "◎",
  },
  strategist: {
    label: "Strategist",
    layer: "Navigation",
    color: "#a78bfa",
    icon: "◈",
  },
  specialist: {
    label: "Specialist",
    layer: "Execution",
    color: "#f472b6",
    icon: "✳",
  },
  synthesizer: {
    label: "Synthesizer",
    layer: "Integration",
    color: "#4f7aff",
    icon: "⬡",
  },
  critic: {
    label: "Critic",
    layer: "Oversight",
    color: "#f59e0b",
    icon: "◉",
  },
  governor: {
    label: "Governor",
    layer: "Sovereignty",
    color: "#34d399",
    icon: "◆",
  },
};

export const TIER_META: Record<
  Memory["tier"],
  { label: string; color: string; description: string }
> = {
  short: {
    label: "Short-term",
    color: "#64748b",
    description: "Current session context",
  },
  medium: {
    label: "Medium-term",
    color: "#4f7aff",
    description: "Active projects & decisions",
  },
  long: {
    label: "Long-term",
    color: "#a78bfa",
    description: "Stable preferences & patterns",
  },
  mythic: {
    label: "Mythic",
    color: "#f59e0b",
    description: "Identity, purpose & direction",
  },
};

export const EVIDENCE_META: Record<
  Memory["evidenceLevel"],
  { label: string; color: string }
> = {
  direct: {
    label: "Direct",
    color: "#34d399",
  },
  repeated: {
    label: "Repeated",
    color: "#4f7aff",
  },
  inferred: {
    label: "Inferred",
    color: "#f59e0b",
  },
  assumed: {
    label: "Assumed",
    color: "#f43f5e",
  },
};

export const VOLATILITY_META: Record<
  Memory["volatility"],
  { label: string; color: string }
> = {
  low: {
    label: "Low",
    color: "#34d399",
  },
  medium: {
    label: "Medium",
    color: "#f59e0b",
  },
  high: {
    label: "High",
    color: "#f43f5e",
  },
};
