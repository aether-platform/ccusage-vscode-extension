export interface ClaudeTranscriptEntry {
  timestamp: string;
  conversation_id: string;
  turn_id: string;
  role: 'user' | 'assistant';
  model: string;
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  project_name?: string;
  project_id?: string;
}

export interface UsageStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCost: number;
  sessions: number;
  dateRange: {
    start: string;
    end: string;
  };
  averageTokensPerSession?: number;
  medianTokensPerSession?: number;
  averageCostPerSession?: number;
  medianCostPerSession?: number;
}

export interface SessionData {
  conversationId: string;
  projectName: string;
  startTime: string;
  endTime: string;
  totalTokens: number;
  totalCost: number;
  model: string;
  turnCount: number;
}

export interface DailyReport {
  date: string;
  stats: UsageStats;
  sessions: SessionData[];
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  stats: UsageStats;
  dailyBreakdown: DailyReport[];
}

export interface MonthlyReport {
  month: string;
  stats: UsageStats;
  dailyBreakdown: DailyReport[];
}

export interface ModelPricing {
  [model: string]: {
    inputTokenPrice: number;    // per million tokens
    outputTokenPrice: number;   // per million tokens
    cacheCreationPrice: number; // per million tokens
    cacheReadPrice: number;     // per million tokens
  };
}

export interface BillingBlock {
  blockId: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  totalTokens: number;
  totalCost: number;
  sessions: SessionData[];
  remainingTime: number; // minutes remaining in block
  tokenRate: number; // tokens per minute
  projectedCost: number; // projected cost if rate continues
}

export interface ModelUsageStats {
  model: string;
  totalTokens: number;
  totalCost: number;
  percentage: number;
  sessions: number;
}