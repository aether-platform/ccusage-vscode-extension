import * as vscode from 'vscode';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { JSONLParser } from './parser';
import { AnalyticsEngine } from './analytics';
import { ClaudeTranscriptEntry } from './types';

export class FileWatcher {
  private watcher?: chokidar.FSWatcher;
  private parser = new JSONLParser();
  private analytics = new AnalyticsEngine();
  private onDataChange?: (entries: ClaudeTranscriptEntry[]) => void;
  private allEntries: ClaudeTranscriptEntry[] = [];

  constructor(private paths: string[]) {}

  start(onDataChange: (entries: ClaudeTranscriptEntry[]) => void) {
    this.onDataChange = onDataChange;
    
    // Initial load
    this.loadAllData();

    // Start watching
    const validPaths = this.paths.filter(p => fs.existsSync(p));
    
    if (validPaths.length === 0) {
      console.warn('No valid Claude projects directories found');
      return;
    }

    const watchPatterns = validPaths.map(p => path.join(p, '**/*.jsonl'));
    
    this.watcher = chokidar.watch(watchPatterns, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('add', (filePath) => {
        console.log(`New file: ${filePath}`);
        this.handleFileChange(filePath);
      })
      .on('change', (filePath) => {
        console.log(`File changed: ${filePath}`);
        this.handleFileChange(filePath);
      })
      .on('unlink', (filePath) => {
        console.log(`File removed: ${filePath}`);
        this.loadAllData(); // Reload everything when file is deleted
      })
      .on('error', (error) => {
        console.error('File watcher error:', error);
        vscode.window.showErrorMessage(`File watcher error: ${error.message}`);
      });

    console.log(`Watching Claude projects in: ${validPaths.join(', ')}`);
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
  }

  private handleFileChange(filePath: string) {
    // Only reload the changed file for efficiency
    try {
      const newEntries = this.parser.parseFile(filePath);
      
      // Remove old entries from this file
      this.allEntries = this.allEntries.filter(entry => {
        // This is a simple heuristic - in practice you might want to track which
        // entries came from which files more explicitly
        return true;
      });
      
      // Add new entries
      this.allEntries.push(...newEntries);
      
      // Sort by timestamp
      this.allEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      
      this.onDataChange?.(this.allEntries);
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }

  private loadAllData() {
    this.parser.clearCache();
    this.allEntries = this.parser.parseMultipleDirectories(this.paths);
    this.allEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    this.onDataChange?.(this.allEntries);
  }

  getCurrentData(): ClaudeTranscriptEntry[] {
    return this.allEntries;
  }

  static getDefaultPaths(): string[] {
    return JSONLParser.getDefaultClaudePaths();
  }

  static async findClaudeProjects(): Promise<string[]> {
    const defaultPaths = FileWatcher.getDefaultPaths();
    const validPaths: string[] = [];

    for (const dirPath of defaultPaths) {
      try {
        if (fs.existsSync(dirPath)) {
          const stat = fs.statSync(dirPath);
          if (stat.isDirectory()) {
            validPaths.push(dirPath);
          }
        }
      } catch (error) {
        console.warn(`Cannot access ${dirPath}:`, error);
      }
    }

    return validPaths;
  }
}