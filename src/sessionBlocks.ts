/**
 * 5-hour session block tracking inspired by ccusage
 * Tracks Claude's billing blocks and usage within them
 */

import { ClaudeTranscriptEntry } from './types';

export interface SessionBlock {
  blockId: string;
  startTime: Date;
  endTime: Date;
  totalTokens: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  sessionCount: number;
  isActive: boolean;
  percentageUsed: number;
}

export class SessionBlockTracker {
  private readonly BLOCK_DURATION_MS = 5 * 60 * 60 * 1000; // 5 hours
  private readonly TOKEN_LIMIT = 1_000_000; // 1M tokens per block
  
  /**
   * Groups entries into 5-hour billing blocks
   */
  identifySessionBlocks(entries: ClaudeTranscriptEntry[]): SessionBlock[] {
    if (entries.length === 0) {
      return [];
    }
    
    // Sort entries by timestamp
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const blocks: SessionBlock[] = [];
    let currentBlock: SessionBlock | null = null;
    
    for (const entry of sortedEntries) {
      const entryTime = new Date(entry.timestamp);
      
      // Check if we need to start a new block
      if (!currentBlock || this.shouldStartNewBlock(currentBlock, entryTime)) {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        
        currentBlock = this.createNewBlock(entryTime);
      }
      
      // Add entry to current block
      if (entry.usage) {
        currentBlock.inputTokens += entry.usage.input_tokens || 0;
        currentBlock.outputTokens += entry.usage.output_tokens || 0;
        currentBlock.cacheCreationTokens += entry.usage.cache_creation_input_tokens || 0;
        currentBlock.cacheReadTokens += entry.usage.cache_read_input_tokens || 0;
        currentBlock.totalTokens = currentBlock.inputTokens + currentBlock.outputTokens;
        // Cost calculation would need pricing data
        currentBlock.sessionCount++;
        
        // Update end time
        if (entryTime > currentBlock.endTime) {
          currentBlock.endTime = entryTime;
        }
      }
    }
    
    // Add the last block
    if (currentBlock) {
      blocks.push(currentBlock);
    }
    
    // Mark active blocks and calculate usage percentages
    const now = new Date();
    for (const block of blocks) {
      block.isActive = (now.getTime() - block.startTime.getTime()) < this.BLOCK_DURATION_MS;
      block.percentageUsed = (block.totalTokens / this.TOKEN_LIMIT) * 100;
    }
    
    return blocks;
  }
  
  private shouldStartNewBlock(currentBlock: SessionBlock, entryTime: Date): boolean {
    // Start new block if more than 5 hours have passed since block start
    const timeSinceBlockStart = entryTime.getTime() - currentBlock.startTime.getTime();
    return timeSinceBlockStart > this.BLOCK_DURATION_MS;
  }
  
  private createNewBlock(startTime: Date): SessionBlock {
    return {
      blockId: `block-${startTime.getTime()}`,
      startTime: new Date(startTime),
      endTime: new Date(startTime),
      totalTokens: 0,
      totalCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      sessionCount: 0,
      isActive: false,
      percentageUsed: 0
    };
  }
  
  /**
   * Gets the currently active block if any
   */
  getActiveBlock(blocks: SessionBlock[]): SessionBlock | null {
    return blocks.find(block => block.isActive) || null;
  }
  
  /**
   * Gets blocks from the last N days
   */
  getRecentBlocks(blocks: SessionBlock[], days: number = 3): SessionBlock[] {
    const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return blocks.filter(block => block.startTime >= cutoffTime);
  }
  
  /**
   * Formats remaining time in a block
   */
  formatRemainingTime(block: SessionBlock): string {
    if (!block.isActive) {
      return 'Expired';
    }
    
    const elapsedMs = Date.now() - block.startTime.getTime();
    const remainingMs = this.BLOCK_DURATION_MS - elapsedMs;
    
    if (remainingMs <= 0) {
      return 'Expired';
    }
    
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    
    return `${hours}h ${minutes}m remaining`;
  }
  
  /**
   * Gets usage warning level
   */
  getWarningLevel(block: SessionBlock): 'none' | 'warning' | 'critical' {
    if (block.percentageUsed >= 90) {
      return 'critical';
    } else if (block.percentageUsed >= 80) {
      return 'warning';
    }
    return 'none';
  }
}