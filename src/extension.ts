import * as vscode from 'vscode';
import { FileWatcher } from './fileWatcher';
import { WebViewProvider } from './webviews';
import { AnalyticsEngine } from './analytics';
import { HostResolver } from './hostResolver';
import { ClaudeTranscriptEntry } from './types';

let fileWatcher: FileWatcher;
let statusBarItem: vscode.StatusBarItem;
let webViewProvider: WebViewProvider;
let analytics: AnalyticsEngine;
let currentEntries: ClaudeTranscriptEntry[] = [];

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Usage Tracker extension is now active!');

  // Initialize components
  webViewProvider = new WebViewProvider();
  analytics = new AnalyticsEngine();

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'ccusage.showDashboard';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  const dashboardCommand = vscode.commands.registerCommand('ccusage.showDashboard', () => {
    webViewProvider.createDashboardWebView(context, currentEntries);
  });

  const dailyReportCommand = vscode.commands.registerCommand('ccusage.showDailyReport', async () => {
    const date = await vscode.window.showInputBox({
      prompt: 'Enter date (YYYY-MM-DD) or leave empty for today',
      value: new Date().toISOString().substring(0, 10)
    });
    if (date !== undefined) {
      webViewProvider.createDailyReportWebView(context, currentEntries, date || undefined);
    }
  });

  const monthlyReportCommand = vscode.commands.registerCommand('ccusage.showMonthlyReport', async () => {
    const month = await vscode.window.showInputBox({
      prompt: 'Enter month (YYYY-MM) or leave empty for current month',
      value: new Date().toISOString().substring(0, 7)
    });
    if (month !== undefined) {
      webViewProvider.createMonthlyReportWebView(context, currentEntries, month || undefined);
    }
  });

  const liveSessionCommand = vscode.commands.registerCommand('ccusage.showLiveSession', () => {
    webViewProvider.createLiveSessionWebView(context, currentEntries);
  });

  const showEnvironmentCommand = vscode.commands.registerCommand('ccusage.showEnvironment', () => {
    HostResolver.showEnvironmentStatus();
  });

  context.subscriptions.push(dashboardCommand, dailyReportCommand, monthlyReportCommand, liveSessionCommand, showEnvironmentCommand);

  // Initialize file watcher
  initializeFileWatcher(context);
}

async function initializeFileWatcher(context: vscode.ExtensionContext) {
  try {
    // Get configured paths or resolve from environment
    const config = vscode.workspace.getConfiguration('ccusage');
    let claudePaths: string[];

    const configuredPath = config.get<string>('claudeProjectsPath');
    if (configuredPath && configuredPath.trim()) {
      claudePaths = [configuredPath.trim()];
    } else {
      // Use host resolver to get environment-appropriate paths
      const environment = await HostResolver.resolveExecutionHost();
      claudePaths = await HostResolver.validateClaudePaths(environment);
      
      if (claudePaths.length === 0) {
        // Show environment-specific error message
        const envType = environment.type;
        let errorMessage = `No Claude projects directory found for ${envType} environment.`;
        let settingsKey = 'ccusage.claudeProjectsPath';
        
        if (envType === 'wsl') {
          errorMessage += ' Check WSL distribution setting and Windows user directory access.';
          settingsKey = 'ccusage.wslDistribution';
        } else if (envType === 'container') {
          errorMessage += ' Check container workspace folder setting and mounted volumes.';
          settingsKey = 'ccusage.containerWorkspaceFolder';
        }
        
        vscode.window.showWarningMessage(
          errorMessage,
          'Open Settings',
          'Show Environment'
        ).then(selection => {
          if (selection === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', settingsKey);
          } else if (selection === 'Show Environment') {
            HostResolver.showEnvironmentStatus();
          }
        });
        updateStatusBar(0, 0);
        return;
      }
    }

    fileWatcher = new FileWatcher(claudePaths);
    
    fileWatcher.start((entries: ClaudeTranscriptEntry[]) => {
      currentEntries = entries;
      updateStatusBarFromEntries(entries);
    });

    console.log(`Watching Claude projects in: ${claudePaths.join(', ')}`);
    
  } catch (error) {
    console.error('Failed to initialize file watcher:', error);
    vscode.window.showErrorMessage(`Failed to initialize Claude usage tracking: ${error}`);
  }
}

function updateStatusBarFromEntries(entries: ClaudeTranscriptEntry[]) {
  const stats = analytics.calculateUsageStats(entries);
  updateStatusBar(stats.totalTokens, stats.totalCost);
}

function updateStatusBar(totalTokens: number, totalCost: number) {
  const config = vscode.workspace.getConfiguration('ccusage');
  const showStatusBar = config.get<boolean>('showStatusBar', true);
  
  if (showStatusBar) {
    statusBarItem.text = `$(pulse) ${totalTokens.toLocaleString()} tokens ($${totalCost.toFixed(2)})`;
    statusBarItem.tooltip = 'Click to view Claude usage dashboard';
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.stop();
  }
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}