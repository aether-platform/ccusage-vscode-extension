import { ClaudeTranscriptEntry, UsageStats, SessionData, DailyReport, WeeklyReport, MonthlyReport, ModelPricing, BillingBlock, ModelUsageStats } from './types';

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

    console.log(`[Analytics] Processing ${entries.length} entries`);
    
    // Debug: Check how many entries have usage data
    const entriesWithUsage = entries.filter(e => e.usage);
    console.log(`[Analytics] Entries with usage data: ${entriesWithUsage.length}/${entries.length}`);
    
    // Debug: Show sample entry with usage
    if (entriesWithUsage.length > 0) {
      console.log(`[Analytics] Sample entry with usage:`, entriesWithUsage[0]);
    }
    
    const dates = entries.map(e => e.timestamp).sort();
    const dateRange = {
      start: dates[0] || '',
      end: dates[dates.length - 1] || ''
    };

    for (const entry of entries) {
      if (!entry.usage) {
        continue;
      }

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

      // Calculate cost - handle model name variations (similar to ccusage)
      let modelKey = entry.model;
      
      // Normalize model names to match our pricing keys
      // Handle both old and new naming conventions
      if (modelKey.includes('claude')) {
        // Already has claude prefix, just normalize
        if (modelKey.includes('sonnet') && modelKey.includes('3.5')) {
          modelKey = 'claude-3-5-sonnet-20241022';
        } else if (modelKey.includes('sonnet-4') || (modelKey.includes('sonnet') && modelKey.includes('4'))) {
          modelKey = 'claude-sonnet-4-20250514';
        } else if (modelKey.includes('opus-4') || (modelKey.includes('opus') && modelKey.includes('4'))) {
          modelKey = 'claude-opus-4-20250514';
        } else if (modelKey.includes('opus') && modelKey.includes('3')) {
          modelKey = 'claude-3-opus-20240229';
        } else if (modelKey.includes('haiku-4') || (modelKey.includes('haiku') && modelKey.includes('4'))) {
          modelKey = 'claude-haiku-4-20250514';
        } else if (modelKey.includes('haiku') && modelKey.includes('3')) {
          modelKey = 'claude-3-haiku-20240307';
        }
      } else {
        // Add claude prefix if missing
        modelKey = `claude-${modelKey}`;
      }
      
      const pricing = this.modelPricing[modelKey];
      let entryCost = 0;
      if (pricing) {
        entryCost = (inputTokens * pricing.inputTokenPrice) / 1_000_000;
        entryCost += (outputTokens * pricing.outputTokenPrice) / 1_000_000;
        entryCost += (cacheCreationTokens * pricing.cacheCreationPrice) / 1_000_000;
        entryCost += (cacheReadTokens * pricing.cacheReadPrice) / 1_000_000;
        totalCost += entryCost;
      } else {
        console.log(`[Analytics] No pricing found for model: ${entry.model} (tried: ${modelKey})`);
      }

      // Log sample entry for debugging
      if (totalCost > 0 && Object.keys(sessionStats).length === 0) {
        console.log(`[Analytics] Sample entry: model=${entry.model}, tokens=${inputTokens + outputTokens}, cost=${entryCost}, pricing:`, pricing);
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

    console.log(`[Analytics] Final stats: totalCost=${totalCost}, totalTokens=${totalInputTokens + totalOutputTokens + totalCacheCreationTokens + totalCacheReadTokens}, sessions=${sessions.size}`);

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

  // 5時間課金ブロックを計算
  getBillingBlocks(entries: ClaudeTranscriptEntry[], limit?: number): BillingBlock[] {
    if (!entries.length) return [];

    // セッションデータを取得
    const sessions = this.extractSessions(entries);
    if (!sessions.length) return [];

    // セッションを時間順にソート
    const sortedSessions = [...sessions].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const blocks: BillingBlock[] = [];
    const blockDuration = 5 * 60 * 60 * 1000; // 5時間（ミリ秒）

    let currentBlock: BillingBlock | null = null;

    for (const session of sortedSessions) {
      const sessionStart = new Date(session.startTime).getTime();

      // 新しいブロックを開始するか判定
      if (!currentBlock || sessionStart >= new Date(currentBlock.endTime).getTime()) {
        // 現在のブロックを保存
        if (currentBlock) {
          blocks.push(currentBlock);
        }

        // 新しいブロックを作成
        const blockStart = new Date(sessionStart);
        const blockEnd = new Date(sessionStart + blockDuration);
        
        currentBlock = {
          blockId: `block_${blockStart.toISOString()}`,
          startTime: blockStart.toISOString(),
          endTime: blockEnd.toISOString(),
          isActive: false,
          totalTokens: 0,
          totalCost: 0,
          sessions: [],
          remainingTime: 0,
          tokenRate: 0,
          projectedCost: 0
        };
      }

      // セッションを現在のブロックに追加
      if (currentBlock) {
        currentBlock.sessions.push(session);
        currentBlock.totalTokens += session.totalTokens;
        currentBlock.totalCost += session.totalCost;
      }
    }

    // 最後のブロックを追加
    if (currentBlock) {
      blocks.push(currentBlock);
    }

    // ブロックの追加情報を計算
    const now = new Date().getTime();
    for (const block of blocks) {
      const blockEnd = new Date(block.endTime).getTime();
      const blockStart = new Date(block.startTime).getTime();
      
      // アクティブブロックかチェック
      block.isActive = now >= blockStart && now < blockEnd;
      
      if (block.isActive) {
        // 残り時間を計算（分）
        block.remainingTime = Math.floor((blockEnd - now) / (1000 * 60));
        
        // トークンレートを計算（トークン/分）
        const elapsedMinutes = Math.floor((now - blockStart) / (1000 * 60));
        if (elapsedMinutes > 0) {
          block.tokenRate = Math.floor(block.totalTokens / elapsedMinutes);
          
          // 残り時間での予想トークン数とコストを計算
          const projectedTokens = block.totalTokens + (block.tokenRate * block.remainingTime);
          const avgCostPerToken = block.totalCost / block.totalTokens;
          block.projectedCost = projectedTokens * avgCostPerToken;
        }
      }
    }

    // 新しい順にソート
    blocks.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    return limit ? blocks.slice(0, limit) : blocks;
  }

  // モデル別の使用統計を計算
  getModelUsageStats(entries: ClaudeTranscriptEntry[]): ModelUsageStats[] {
    const modelStats: { [model: string]: ModelUsageStats } = {};
    let totalTokens = 0;
    let totalCost = 0;

    // エントリーごとにモデル別に集計
    for (const entry of entries) {
      const model = entry.model;
      if (!modelStats[model]) {
        modelStats[model] = {
          model,
          totalTokens: 0,
          totalCost: 0,
          percentage: 0,
          sessions: 0
        };
      }

      const usage = entry.usage || {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0
      };

      const tokens = usage.input_tokens + usage.output_tokens + 
                     (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
      const cost = this.calculateEntryCost(entry);

      modelStats[model].totalTokens += tokens;
      modelStats[model].totalCost += cost;
      totalTokens += tokens;
      totalCost += cost;
    }

    // セッション数をカウント
    const sessions = this.extractSessions(entries);
    for (const session of sessions) {
      if (modelStats[session.model]) {
        modelStats[session.model].sessions++;
      }
    }

    // パーセンテージを計算
    const statsArray = Object.values(modelStats);
    for (const stat of statsArray) {
      stat.percentage = totalTokens > 0 ? (stat.totalTokens / totalTokens) * 100 : 0;
    }

    // トークン数の多い順にソート
    return statsArray.sort((a, b) => b.totalTokens - a.totalTokens);
  }

  // エントリー単体のコストを計算
  private calculateEntryCost(entry: ClaudeTranscriptEntry): number {
    const pricing = this.modelPricing[entry.model];
    if (!pricing || !entry.usage) return 0;

    const usage = entry.usage;
    let cost = 0;
    cost += (usage.input_tokens || 0) * pricing.inputTokenPrice / 1_000_000;
    cost += (usage.output_tokens || 0) * pricing.outputTokenPrice / 1_000_000;
    cost += (usage.cache_creation_input_tokens || 0) * pricing.cacheCreationPrice / 1_000_000;
    cost += (usage.cache_read_input_tokens || 0) * pricing.cacheReadPrice / 1_000_000;
    
    return cost;
  }
}