import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
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
  statusBarItem.text = '$(file-code) Claude Usage (Loading...)';
  statusBarItem.tooltip = 'Claude Code usage tracker - Loading data...';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  const dashboardCommand = vscode.commands.registerCommand('ccusage.showDashboard', () => {
    webViewProvider.createDashboardWebView(context, currentEntries);
  });

  const showEnvironmentCommand = vscode.commands.registerCommand('ccusage.showEnvironment', () => {
    HostResolver.showEnvironmentStatus();
  });

  const showSponsorInfoCommand = vscode.commands.registerCommand('ccusage.showSponsorInfo', () => {
    webViewProvider.createSponsorWebView(context);
  });

  const detectClaudePathCommand = vscode.commands.registerCommand('ccusage.detectClaudePath', async () => {
    await detectAndSetClaudePath(context);
  });

  const resetSettingsCommand = vscode.commands.registerCommand('ccusage.resetSettings', async () => {
    await resetAllSettings();
  });

  context.subscriptions.push(
    dashboardCommand, 
    showEnvironmentCommand, 
    showSponsorInfoCommand,
    detectClaudePathCommand,
    resetSettingsCommand
  );

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
      console.log(`Detected environment: ${environment.type}`);
      console.log(`Checking paths:`, environment.claudePaths);
      
      claudePaths = await HostResolver.validateClaudePaths(environment);
      console.log(`Valid Claude paths found:`, claudePaths);
      
      if (claudePaths.length === 0) {
        // Show environment-specific error message
        const envType = environment.type;
        const isWindows = process.platform === 'win32';
        let errorMessage = `No Claude projects directory found for ${envType} environment.`;
        let settingsKey = 'ccusage.claudeProjectsPath';
        
        if (envType === 'wsl') {
          errorMessage += ' Check WSL distribution setting and Windows user directory access.';
          settingsKey = 'ccusage.wslDistribution';
        } else if (envType === 'container') {
          errorMessage += ' Check container workspace folder setting and mounted volumes.';
          settingsKey = 'ccusage.containerWorkspaceFolder';
        } else if (isWindows && envType === 'local') {
          errorMessage += ' Windows users: Consider using VS Code with WSL for better Claude Code integration.';
        }
        
        const options = isWindows && envType === 'local' 
          ? ['Connect to WSL', 'Open Settings', 'Show Environment']
          : ['Open Settings', 'Show Environment'];
        
        vscode.window.showWarningMessage(errorMessage, ...options).then(selection => {
          if (selection === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', settingsKey);
          } else if (selection === 'Show Environment') {
            HostResolver.showEnvironmentStatus();
          } else if (selection === 'Connect to WSL') {
            vscode.commands.executeCommand('remote-wsl.newWindow');
          }
        });
        updateStatusBar(0, 0);
        return;
      }
    }

    fileWatcher = new FileWatcher(claudePaths);
    
    fileWatcher.start((entries: ClaudeTranscriptEntry[]) => {
      currentEntries = entries;
      console.log(`Loaded ${entries.length} entries from Claude Code data`);
      if (entries.length > 0) {
        console.log(`Latest entry: ${entries[entries.length - 1]?.timestamp || 'N/A'}`);
        console.log(`Sample entry:`, entries[0]);
        
        // Debug: Check if entries have cost data
        const entriesWithCost = entries.filter(e => e.usage && (e.usage.input_tokens > 0 || e.usage.output_tokens > 0));
        console.log(`Entries with usage data: ${entriesWithCost.length}/${entries.length}`);
        if (entriesWithCost.length > 0) {
          console.log(`Sample usage data:`, entriesWithCost[0].usage);
        }
      }
      updateStatusBarFromEntries(entries);
      
      // 既存のWebViewパネルがあれば更新
      webViewProvider.updateExistingPanels(entries);
    });

    console.log(`Watching Claude projects in: ${claudePaths.join(', ')}`);
    
  } catch (error) {
    console.error('Failed to initialize file watcher:', error);
    // Show warning instead of error for missing .claude directory
    const isWindows = process.platform === 'win32';
    const message = isWindows 
      ? 'Claude usage tracking could not be initialized. Windows users: Consider using VS Code with WSL for better Claude Code integration.'
      : 'Claude usage tracking could not be initialized. Please ensure Claude Code is installed and has been used.';
    
    const options = isWindows 
      ? ['Connect to WSL', 'Check Environment']
      : ['Check Environment'];
    
    vscode.window.showWarningMessage(message, ...options).then(selection => {
      if (selection === 'Check Environment') {
        vscode.commands.executeCommand('ccusage.showEnvironment');
      } else if (selection === 'Connect to WSL') {
        vscode.commands.executeCommand('remote-wsl.newWindow');
      }
    });
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
    statusBarItem.tooltip = `Click to view Claude usage dashboard\nEntries loaded: ${currentEntries.length}`;
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

async function detectAndSetClaudePath(context: vscode.ExtensionContext) {
  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Detecting Claude paths...',
    cancellable: false
  }, async (progress) => {
    try {
      // Get environment and paths
      const environment = await HostResolver.resolveExecutionHost();
      const validPaths = await HostResolver.validateClaudePaths(environment);
      
      progress.report({ increment: 50 });
      
      if (validPaths.length === 0) {
        vscode.window.showWarningMessage(
          'No Claude project directories found. Please ensure Claude Code is installed and has been used.',
          'Check Environment'
        ).then(selection => {
          if (selection === 'Check Environment') {
            vscode.commands.executeCommand('ccusage.showEnvironment');
          }
        });
        return;
      }
      
      // If multiple paths found, let user choose
      let selectedPath = validPaths[0];
      if (validPaths.length > 1) {
        const items = validPaths.map(p => ({
          label: p,
          description: `${countProjectsInPath(p)} projects found`,
          path: p
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select Claude projects path',
          title: 'Multiple Claude paths detected'
        });
        
        if (!selected) {
          return;
        }
        selectedPath = selected.path;
      }
      
      progress.report({ increment: 30 });
      
      // Update configuration
      const config = vscode.workspace.getConfiguration('ccusage');
      await config.update('claudeProjectsPath', selectedPath, vscode.ConfigurationTarget.Global);
      
      progress.report({ increment: 20 });
      
      vscode.window.showInformationMessage(
        `Claude path set to: ${selectedPath}`,
        'Reload Extension'
      ).then(selection => {
        if (selection === 'Reload Extension') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to detect Claude path: ${error}`);
    }
  });
}

async function resetAllSettings() {
  const answer = await vscode.window.showWarningMessage(
    'This will reset all Claude Usage Tracker settings to default. Continue?',
    'Yes', 'No'
  );
  
  if (answer !== 'Yes') {
    return;
  }
  
  const config = vscode.workspace.getConfiguration('ccusage');
  
  // Reset all settings
  await config.update('claudeProjectsPath', undefined, vscode.ConfigurationTarget.Global);
  await config.update('executionHost', undefined, vscode.ConfigurationTarget.Global);
  await config.update('wslDistribution', undefined, vscode.ConfigurationTarget.Global);
  await config.update('wslWindowsUsername', undefined, vscode.ConfigurationTarget.Global);
  await config.update('wslClaudePath', undefined, vscode.ConfigurationTarget.Global);
  await config.update('containerWorkspaceFolder', undefined, vscode.ConfigurationTarget.Global);
  await config.update('refreshInterval', undefined, vscode.ConfigurationTarget.Global);
  await config.update('showStatusBar', undefined, vscode.ConfigurationTarget.Global);
  
  vscode.window.showInformationMessage(
    'Settings reset to default. The extension will now auto-detect paths.',
    'Reload Extension'
  ).then(selection => {
    if (selection === 'Reload Extension') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  });
}

function countProjectsInPath(claudePath: string): number {
  try {
    const entries = fileWatcher ? 
      fileWatcher.getCurrentData().filter(e => e.project_name) : 
      [];
    const projects = new Set(entries.map(e => e.project_name));
    return projects.size || fs.readdirSync(claudePath).filter(f => fs.statSync(path.join(claudePath, f)).isDirectory()).length;
  } catch {
    return 0;
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