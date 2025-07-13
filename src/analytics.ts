import { ClaudeTranscriptEntry, UsageStats, SessionData, DailyReport, MonthlyReport, ModelPricing } from './types';

export class AnalyticsEngine {
  private modelPricing: ModelPricing = {
    'claude-3-5-sonnet-20241022': {
      inputTokenPrice: 3.0,
      outputTokenPrice: 15.0,
      cacheCreationPrice: 3.75,
      cacheReadPrice: 0.30
    },
    'claude-3-5-sonnet-20240620': {
      inputTokenPrice: 3.0,
      outputTokenPrice: 15.0,
      cacheCreationPrice: 3.75,
      cacheReadPrice: 0.30
    },
    'claude-3-opus-20240229': {
      inputTokenPrice: 15.0,
      outputTokenPrice: 75.0,
      cacheCreationPrice: 18.75,
      cacheReadPrice: 1.50
    },
    'claude-3-haiku-20240307': {
      inputTokenPrice: 0.25,
      outputTokenPrice: 1.25,
      cacheCreationPrice: 0.30,
      cacheReadPrice: 0.03
    }
  };

  calculateUsageStats(entries: ClaudeTranscriptEntry[]): UsageStats {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheCreationTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCost = 0;
    const sessions = new Set<string>();

    const dates = entries.map(e => e.timestamp).sort();
    const dateRange = {
      start: dates[0] || '',
      end: dates[dates.length - 1] || ''
    };

    for (const entry of entries) {
      if (!entry.usage) continue;

      const usage = entry.usage;
      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
      const cacheReadTokens = usage.cache_read_input_tokens || 0;

      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      totalCacheCreationTokens += cacheCreationTokens;
      totalCacheReadTokens += cacheReadTokens;

      sessions.add(entry.conversation_id);

      // Calculate cost
      const pricing = this.modelPricing[entry.model];
      if (pricing) {
        totalCost += (inputTokens * pricing.inputTokenPrice) / 1_000_000;
        totalCost += (outputTokens * pricing.outputTokenPrice) / 1_000_000;
        totalCost += (cacheCreationTokens * pricing.cacheCreationPrice) / 1_000_000;
        totalCost += (cacheReadTokens * pricing.cacheReadPrice) / 1_000_000;
      }
    }

    return {
      totalTokens: totalInputTokens + totalOutputTokens + totalCacheCreationTokens + totalCacheReadTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheCreationTokens: totalCacheCreationTokens,
      cacheReadTokens: totalCacheReadTokens,
      totalCost,
      sessions: sessions.size,
      dateRange
    };
  }

  generateDailyReport(entries: ClaudeTranscriptEntry[], date: string): DailyReport {
    const dayEntries = entries.filter(entry => 
      entry.timestamp.startsWith(date)
    );

    const stats = this.calculateUsageStats(dayEntries);
    const sessions = this.extractSessions(dayEntries);

    return {
      date,
      stats,
      sessions
    };
  }

  generateMonthlyReport(entries: ClaudeTranscriptEntry[], month: string): MonthlyReport {
    const monthEntries = entries.filter(entry => 
      entry.timestamp.startsWith(month)
    );

    const stats = this.calculateUsageStats(monthEntries);
    
    // Generate daily breakdown
    const dailyBreakdown: DailyReport[] = [];
    const dates = new Set(monthEntries.map(entry => entry.timestamp.substring(0, 10)));
    
    for (const date of Array.from(dates).sort()) {
      dailyBreakdown.push(this.generateDailyReport(monthEntries, date));
    }

    return {
      month,
      stats,
      dailyBreakdown
    };
  }

  extractSessions(entries: ClaudeTranscriptEntry[]): SessionData[] {
    const sessionMap = new Map<string, SessionData>();

    for (const entry of entries) {
      const sessionId = entry.conversation_id;
      
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          conversationId: sessionId,
          projectName: entry.project_name || 'Unknown',
          startTime: entry.timestamp,
          endTime: entry.timestamp,
          totalTokens: 0,
          totalCost: 0,
          model: entry.model,
          turnCount: 0
        });
      }

      const session = sessionMap.get(sessionId)!;
      session.endTime = entry.timestamp;
      session.turnCount++;

      if (entry.usage) {
        const usage = entry.usage;
        const tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0) + 
                      (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
        session.totalTokens += tokens;

        const pricing = this.modelPricing[entry.model];
        if (pricing) {
          const cost = ((usage.input_tokens || 0) * pricing.inputTokenPrice +
                       (usage.output_tokens || 0) * pricing.outputTokenPrice +
                       (usage.cache_creation_input_tokens || 0) * pricing.cacheCreationPrice +
                       (usage.cache_read_input_tokens || 0) * pricing.cacheReadPrice) / 1_000_000;
          session.totalCost += cost;
        }
      }
    }

    return Array.from(sessionMap.values()).sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  filterEntriesByDateRange(entries: ClaudeTranscriptEntry[], since?: string, until?: string): ClaudeTranscriptEntry[] {
    return entries.filter(entry => {
      const entryDate = entry.timestamp.substring(0, 10);
      if (since && entryDate < since) return false;
      if (until && entryDate > until) return false;
      return true;
    });
  }

  getRecentEntries(entries: ClaudeTranscriptEntry[], hours: number): ClaudeTranscriptEntry[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return entries.filter(entry => entry.timestamp >= cutoff);
  }

  getLiveSessionData(entries: ClaudeTranscriptEntry[]): SessionData[] {
    const recentEntries = this.getRecentEntries(entries, 1); // Last hour
    return this.extractSessions(recentEntries);
  }
}