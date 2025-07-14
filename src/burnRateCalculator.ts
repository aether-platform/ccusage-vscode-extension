/**
 * Burn rate calculator inspired by Maciek-roboblog's Claude Usage Monitor
 * Calculates token consumption rate and predictions
 */

import { ClaudeTranscriptEntry } from './types';

export interface BurnRateStats {
  tokensPerHour: number;
  tokensPerDay: number;
  costPerHour: number;
  costPerDay: number;
  averageTokensPerSession: number;
  sessionsPerDay: number;
}

export interface UsagePrediction {
  remainingDays: number;
  remainingHours: number;
  predictedExhaustionDate: Date;
  currentPace: 'slow' | 'normal' | 'fast' | 'very fast';
}

export class BurnRateCalculator {
  private readonly FIVE_HOUR_BLOCK_TOKENS = 1_000_000; // Claude's 5-hour block limit
  private readonly HOURLY_RATE_TOKENS = 200_000; // 1M tokens / 5 hours
  
  calculateBurnRate(entries: ClaudeTranscriptEntry[], hoursToAnalyze: number = 24): BurnRateStats {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - (hoursToAnalyze * 60 * 60 * 1000));
    
    // Filter entries within the time window
    const recentEntries = entries.filter(entry => {
      const entryTime = new Date(entry.timestamp);
      return entryTime >= cutoffTime && entryTime <= now;
    });
    
    if (recentEntries.length === 0) {
      return {
        tokensPerHour: 0,
        tokensPerDay: 0,
        costPerHour: 0,
        costPerDay: 0,
        averageTokensPerSession: 0,
        sessionsPerDay: 0
      };
    }
    
    // Calculate total tokens and cost
    let totalTokens = 0;
    let totalCost = 0;
    const sessions = new Set<string>();
    
    for (const entry of recentEntries) {
      if (entry.usage) {
        totalTokens += (entry.usage.input_tokens || 0) + (entry.usage.output_tokens || 0);
        // Note: Cost calculation would need pricing data
      }
      sessions.add(entry.conversation_id);
    }
    
    // Calculate rates
    const actualHours = Math.min(hoursToAnalyze, (now.getTime() - new Date(recentEntries[0].timestamp).getTime()) / (60 * 60 * 1000));
    const tokensPerHour = totalTokens / actualHours;
    const tokensPerDay = tokensPerHour * 24;
    const costPerHour = totalCost / actualHours;
    const costPerDay = costPerHour * 24;
    const sessionsPerDay = (sessions.size / actualHours) * 24;
    const averageTokensPerSession = sessions.size > 0 ? totalTokens / sessions.size : 0;
    
    return {
      tokensPerHour: Math.round(tokensPerHour),
      tokensPerDay: Math.round(tokensPerDay),
      costPerHour,
      costPerDay,
      averageTokensPerSession: Math.round(averageTokensPerSession),
      sessionsPerDay: Math.round(sessionsPerDay * 10) / 10
    };
  }
  
  predictUsageExhaustion(currentUsage: number, burnRate: BurnRateStats): UsagePrediction {
    const remainingTokens = this.FIVE_HOUR_BLOCK_TOKENS - currentUsage;
    
    if (burnRate.tokensPerHour === 0) {
      return {
        remainingDays: Infinity,
        remainingHours: Infinity,
        predictedExhaustionDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        currentPace: 'slow'
      };
    }
    
    const remainingHours = remainingTokens / burnRate.tokensPerHour;
    const remainingDays = remainingHours / 24;
    const predictedExhaustionDate = new Date(Date.now() + remainingHours * 60 * 60 * 1000);
    
    // Determine pace based on hourly rate vs Claude's intended rate
    let currentPace: UsagePrediction['currentPace'];
    const paceRatio = burnRate.tokensPerHour / this.HOURLY_RATE_TOKENS;
    
    if (paceRatio < 0.5) {
      currentPace = 'slow';
    } else if (paceRatio < 1.0) {
      currentPace = 'normal';
    } else if (paceRatio < 2.0) {
      currentPace = 'fast';
    } else {
      currentPace = 'very fast';
    }
    
    return {
      remainingDays: Math.max(0, remainingDays),
      remainingHours: Math.max(0, remainingHours),
      predictedExhaustionDate,
      currentPace
    };
  }
  
  getRecommendation(prediction: UsagePrediction): string {
    if (prediction.currentPace === 'very fast' && prediction.remainingHours < 1) {
      return '⚠️ CRITICAL: You will run out of tokens within the hour at current pace!';
    } else if (prediction.remainingHours < 2) {
      return '⚠️ WARNING: Less than 2 hours of tokens remaining';
    } else if (prediction.currentPace === 'very fast') {
      return '🔥 You are using tokens much faster than the intended rate';
    } else if (prediction.currentPace === 'fast') {
      return '⚡ You are using tokens faster than the intended rate';
    } else if (prediction.remainingDays > 7) {
      return '✅ Token usage is at a sustainable pace';
    } else {
      return '📊 Token usage is within normal range';
    }
  }
}