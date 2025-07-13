import { ClaudeTranscriptEntry, UsageStats, SessionData, DailyReport, WeeklyReport, MonthlyReport, ModelPricing } from './types';

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
    },
    // New Claude models
    'claude-opus-4-20250514': {
      inputTokenPrice: 15.0,
      outputTokenPrice: 75.0,
      cacheCreationPrice: 18.75,
      cacheReadPrice: 1.50
    },
    'claude-sonnet-4-20250514': {
      inputTokenPrice: 3.0,
      outputTokenPrice: 15.0,
      cacheCreationPrice: 3.75,
      cacheReadPrice: 0.30
    },
    'claude-haiku-4-20250514': {
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
    const sessionStats = new Map<string, { tokens: number; cost: number }>();

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
      let entryCost = 0;
      if (pricing) {
        entryCost = (inputTokens * pricing.inputTokenPrice) / 1_000_000;
        entryCost += (outputTokens * pricing.outputTokenPrice) / 1_000_000;
        entryCost += (cacheCreationTokens * pricing.cacheCreationPrice) / 1_000_000;
        entryCost += (cacheReadTokens * pricing.cacheReadPrice) / 1_000_000;
        totalCost += entryCost;
      }

      // Track per-session stats
      const entryTokens = inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;
      if (!sessionStats.has(entry.conversation_id)) {
        sessionStats.set(entry.conversation_id, { tokens: 0, cost: 0 });
      }
      const sessionStat = sessionStats.get(entry.conversation_id)!;
      sessionStat.tokens += entryTokens;
      sessionStat.cost += entryCost;
    }

    // Calculate averages and medians
    const sessionTokens = Array.from(sessionStats.values()).map(s => s.tokens);
    const sessionCosts = Array.from(sessionStats.values()).map(s => s.cost);
    
    const averageTokensPerSession = sessionTokens.length > 0 ? 
      sessionTokens.reduce((sum, tokens) => sum + tokens, 0) / sessionTokens.length : 0;
    
    const averageCostPerSession = sessionCosts.length > 0 ?
      sessionCosts.reduce((sum, cost) => sum + cost, 0) / sessionCosts.length : 0;

    const medianTokensPerSession = this.calculateMedian(sessionTokens);
    const medianCostPerSession = this.calculateMedian(sessionCosts);

    return {
      totalTokens: totalInputTokens + totalOutputTokens + totalCacheCreationTokens + totalCacheReadTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheCreationTokens: totalCacheCreationTokens,
      cacheReadTokens: totalCacheReadTokens,
      totalCost,
      sessions: sessions.size,
      dateRange,
      averageTokensPerSession,
      medianTokensPerSession,
      averageCostPerSession,
      medianCostPerSession
    };
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
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

  generateWeeklyReport(entries: ClaudeTranscriptEntry[], weekStart: string): WeeklyReport {
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    
    const weekStartStr = weekStartDate.toISOString().substring(0, 10);
    const weekEndStr = weekEndDate.toISOString().substring(0, 10);
    
    const weekEntries = entries.filter(entry => {
      const entryDate = entry.timestamp.substring(0, 10);
      return entryDate >= weekStartStr && entryDate <= weekEndStr;
    });

    const stats = this.calculateUsageStats(weekEntries);
    
    // Generate daily breakdown for the week
    const dailyBreakdown: DailyReport[] = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStartDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().substring(0, 10);
      dailyBreakdown.push(this.generateDailyReport(weekEntries, dateStr));
    }

    return {
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      stats,
      dailyBreakdown
    };
  }

  getRecentDays(entries: ClaudeTranscriptEntry[], days: number = 30): DailyReport[] {
    const dailyReports: DailyReport[] = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().substring(0, 10);
      dailyReports.push(this.generateDailyReport(entries, dateStr));
    }
    
    return dailyReports;
  }

  getRecentWeeks(entries: ClaudeTranscriptEntry[], weeks: number = 12): WeeklyReport[] {
    const weeklyReports: WeeklyReport[] = [];
    const today = new Date();
    
    // Get Monday of current week
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - today.getDay() + 1);
    
    for (let i = weeks - 1; i >= 0; i--) {
      const weekStart = new Date(currentMonday);
      weekStart.setDate(currentMonday.getDate() - (i * 7));
      const weekStartStr = weekStart.toISOString().substring(0, 10);
      weeklyReports.push(this.generateWeeklyReport(entries, weekStartStr));
    }
    
    return weeklyReports;
  }

  getRecentMonths(entries: ClaudeTranscriptEntry[], months: number = 12): MonthlyReport[] {
    const monthlyReports: MonthlyReport[] = [];
    const today = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = date.toISOString().substring(0, 7);
      monthlyReports.push(this.generateMonthlyReport(entries, monthStr));
    }
    
    return monthlyReports;
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

  getTodayStats(entries: ClaudeTranscriptEntry[]): UsageStats {
    const today = new Date().toISOString().substring(0, 10);
    const todayEntries = entries.filter(entry => 
      entry.timestamp.startsWith(today)
    );
    return this.calculateUsageStats(todayEntries);
  }

  getUsageInsights(entries: ClaudeTranscriptEntry[]): string {
    if (entries.length === 0) {
      return "新しいClaude Codeユーザーですね！まずは使ってみて、統計データを蓄積しましょう。";
    }

    const today = new Date().toISOString().substring(0, 10);
    const currentMonth = new Date().toISOString().substring(0, 7);
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().substring(0, 7);

    const todayStats = this.getTodayStats(entries);
    const currentMonthEntries = entries.filter(e => e.timestamp.startsWith(currentMonth));
    const lastMonthEntries = entries.filter(e => e.timestamp.startsWith(lastMonth));

    const todayTokens = todayStats.totalTokens;
    const todayCost = todayStats.totalCost;

    // Current month calculations
    const currentMonthCost = this.calculateUsageStats(currentMonthEntries).totalCost;
    const daysIntoMonth = new Date().getDate();
    const totalDaysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const projectedMonthlyCost = (currentMonthCost / daysIntoMonth) * totalDaysInMonth;

    // Last month calculations for comparison
    const lastMonthCost = this.calculateUsageStats(lastMonthEntries).totalCost;
    const lastMonthAvgDaily = lastMonthCost / 30; // Approximate daily average

    let insights = [];

    // Daily vs monthly average comparison
    if (todayTokens === 0) {
      insights.push("今日はまだClaude Codeを使っていません。");
    } else if (todayCost > lastMonthAvgDaily * 1.3) {
      insights.push("今日の利用量は月間平均を上回っています。集中的な作業をされているようですね！");
    } else if (todayCost < lastMonthAvgDaily * 0.7 && lastMonthAvgDaily > 0) {
      insights.push("今日の利用量は月間平均を下回っています。軽めの作業日でしょうか。");
    } else {
      insights.push("今日の利用量は月間平均と同程度です。安定したペースでClaude Codeを活用されています。");
    }

    // $300 plan assessment
    if (projectedMonthlyCost > 250) {
      insights.push("このペースだと月額$300プランの元は十分取れそうです！高い生産性を維持されています。");
    } else if (projectedMonthlyCost > 150) {
      insights.push("$300プランを適度に活用されています。さらに使いこなせばより元が取れるでしょう。");
    } else if (projectedMonthlyCost > 50) {
      insights.push("$300プランに対してはまだ余裕があります。もっと積極的に活用できそうです。");
    } else if (projectedMonthlyCost > 0) {
      insights.push("$300プランの利用量としては控えめです。より多くのタスクでClaude Codeを活用してみてはいかがでしょうか。");
    }

    // Add monthly projection info
    if (projectedMonthlyCost > 0) {
      insights.push(`今月の予想コスト: $${projectedMonthlyCost.toFixed(2)}`);
    }

    return insights.join(' ');
  }
}