import * as fs from 'fs';
import * as path from 'path';
import { ClaudeTranscriptEntry } from './types';
import { HostResolver } from './hostResolver';

export class JSONLParser {
  private processedEntries = new Set<string>();
  private processedHashes = new Set<string>(); // For deduplication by message+request ID

  parseFile(filePath: string): ClaudeTranscriptEntry[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      const entries: ClaudeTranscriptEntry[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const rawEntry = JSON.parse(line);
          
          // Validate JSONL structure
          if (!rawEntry.message || !rawEntry.timestamp) {
            continue;
          }
          
          // Extract usage data - it should be in message.usage
          const usage = rawEntry.message?.usage;
          
          // Skip entries without usage data
          if (!usage) {
            continue;
          }
          
          // Check if there are any tokens at all - note the underscores in field names
          const inputTokens = usage.input_tokens || 0;
          const outputTokens = usage.output_tokens || 0;
          const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
          const cacheReadTokens = usage.cache_read_input_tokens || 0;
          
          const hasTokens = inputTokens > 0 || outputTokens > 0 || cacheCreationTokens > 0 || cacheReadTokens > 0;
          
          if (!hasTokens) {
            continue;
          }
          
          // Create unique hash for deduplication (like ccusage)
          const messageId = rawEntry.message?.id;
          const requestId = rawEntry.requestId;
          if (messageId && requestId) {
            const uniqueHash = `${messageId}:${requestId}`;
            if (this.processedHashes.has(uniqueHash)) {
              continue; // Skip duplicate
            }
            this.processedHashes.add(uniqueHash);
          }
          
          // Debug: Log first entry with usage
          if (!this.processedEntries.has('debug_logged') && usage) {
            console.log('[Parser] Sample entry with usage:', {
              timestamp: rawEntry.timestamp,
              model: rawEntry.message?.model,
              usage: usage,
              messageId: messageId,
              requestId: requestId
            });
            this.processedEntries.add('debug_logged');
          }
          
          // Create usage object in the format expected by analytics
          const formattedUsage = {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cache_creation_input_tokens: cacheCreationTokens,
            cache_read_input_tokens: cacheReadTokens
          };
          
          const entry: ClaudeTranscriptEntry = {
            timestamp: rawEntry.timestamp,
            conversation_id: rawEntry.sessionId || rawEntry.uuid,
            turn_id: rawEntry.uuid || messageId || '',
            role: rawEntry.message.role || 'assistant',
            model: rawEntry.message.model || 'unknown',
            content: this.extractContent(rawEntry.message.content),
            usage: formattedUsage,
            project_name: this.extractProjectName(rawEntry.cwd || filePath),
            project_id: rawEntry.sessionId || 'unknown'
          };
          
          const entryId = this.generateEntryId(entry);
          
          // Global deduplication
          if (!this.processedEntries.has(entryId)) {
            this.processedEntries.add(entryId);
            entries.push(entry);
          }
        } catch (parseError) {
          console.warn(`Failed to parse line in ${filePath}:`, line);
        }
      }

      return entries;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return [];
    }
  }

  parseDirectory(dirPath: string): ClaudeTranscriptEntry[] {
    const allEntries: ClaudeTranscriptEntry[] = [];

    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const filePath = path.join(dirPath, file);
          const entries = this.parseFile(filePath);
          allEntries.push(...entries);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }

    return allEntries;
  }

  parseMultipleDirectories(dirPaths: string[]): ClaudeTranscriptEntry[] {
    const allEntries: ClaudeTranscriptEntry[] = [];

    for (const dirPath of dirPaths) {
      if (fs.existsSync(dirPath)) {
        const entries = this.parseDirectory(dirPath);
        allEntries.push(...entries);
      }
    }

    return allEntries;
  }

  private generateEntryId(entry: ClaudeTranscriptEntry): string {
    return `${entry.conversation_id}-${entry.turn_id}-${entry.timestamp}`;
  }

  private extractProjectName(cwd: string): string {
    if (!cwd) return 'Unknown Project';
    return cwd.split('/').pop() || 'Unknown Project';
  }

  clearCache(): void {
    this.processedEntries.clear();
    this.processedHashes.clear();
  }
  
  private extractContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      // Handle content array format like ccusage
      return content.map(item => {
        if (typeof item === 'string') return item;
        if (item?.text) return item.text;
        if (item?.type === 'text' && item?.text) return item.text;
        return JSON.stringify(item);
      }).join('\n');
    }
    return JSON.stringify(content);
  }

  static async getDefaultClaudePaths(): Promise<string[]> {
    try {
      const environment = await HostResolver.resolveExecutionHost();
      const validPaths = await HostResolver.validateClaudePaths(environment);
      console.log(`[Parser] Found ${validPaths.length} valid Claude paths:`, validPaths);
      return validPaths;
    } catch (error) {
      console.error('[Parser] Error resolving Claude paths:', error);
      // Fallback to simple homedir method
      const homedir = require('os').homedir();
      return [
        path.join(homedir, '.claude', 'projects'),
        path.join(homedir, '.config', 'claude', 'projects')
      ];
    }
  }
}