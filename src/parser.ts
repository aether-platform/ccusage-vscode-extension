import * as fs from 'fs';
import * as path from 'path';
import { ClaudeTranscriptEntry } from './types';

export class JSONLParser {
  private processedEntries = new Set<string>();

  parseFile(filePath: string): ClaudeTranscriptEntry[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      const entries: ClaudeTranscriptEntry[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const entry = JSON.parse(line) as ClaudeTranscriptEntry;
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

  clearCache(): void {
    this.processedEntries.clear();
  }

  static getDefaultClaudePaths(): string[] {
    const homedir = require('os').homedir();
    return [
      path.join(homedir, '.claude', 'projects'),
      path.join(homedir, '.config', 'claude', 'projects')
    ];
  }
}