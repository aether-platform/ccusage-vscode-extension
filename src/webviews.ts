import * as vscode from 'vscode';
import { AnalyticsEngine } from './analytics';
import { ClaudeTranscriptEntry, UsageStats, SessionData } from './types';

export class WebViewProvider {
  private analytics = new AnalyticsEngine();

  createDashboardWebView(context: vscode.ExtensionContext, entries: ClaudeTranscriptEntry[]): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'claudeUsageDashboard',
      'Claude Usage Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    const stats = this.analytics.calculateUsageStats(entries);
    const recentSessions = this.analytics.getLiveSessionData(entries);
    
    panel.webview.html = this.getDashboardHtml(stats, recentSessions);
    
    return panel;
  }

  createDailyReportWebView(context: vscode.ExtensionContext, entries: ClaudeTranscriptEntry[], date?: string): vscode.WebviewPanel {
    const targetDate = date || new Date().toISOString().substring(0, 10);
    const report = this.analytics.generateDailyReport(entries, targetDate);
    
    const panel = vscode.window.createWebviewPanel(
      'claudeUsageDaily',
      `Claude Usage - ${targetDate}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    panel.webview.html = this.getDailyReportHtml(report);
    
    return panel;
  }

  createMonthlyReportWebView(context: vscode.ExtensionContext, entries: ClaudeTranscriptEntry[], month?: string): vscode.WebviewPanel {
    const targetMonth = month || new Date().toISOString().substring(0, 7);
    const report = this.analytics.generateMonthlyReport(entries, targetMonth);
    
    const panel = vscode.window.createWebviewPanel(
      'claudeUsageMonthly',
      `Claude Usage - ${targetMonth}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    panel.webview.html = this.getMonthlyReportHtml(report);
    
    return panel;
  }

  createLiveSessionWebView(context: vscode.ExtensionContext, entries: ClaudeTranscriptEntry[]): vscode.WebviewPanel {
    const activeSessions = this.analytics.getLiveSessionData(entries);
    
    const panel = vscode.window.createWebviewPanel(
      'claudeUsageLive',
      'Claude Usage - Live Sessions',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    panel.webview.html = this.getLiveSessionHtml(activeSessions);
    
    return panel;
  }

  private getDashboardHtml(stats: UsageStats, sessions: SessionData[]): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Claude Usage Dashboard</title>
        <style>
            body { 
                font-family: var(--vscode-font-family); 
                padding: 20px; 
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .stat-card {
                padding: 20px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 8px;
                background-color: var(--vscode-panel-background);
            }
            .stat-value {
                font-size: 24px;
                font-weight: bold;
                color: var(--vscode-charts-blue);
                margin-bottom: 5px;
            }
            .stat-label {
                font-size: 14px;
                color: var(--vscode-descriptionForeground);
            }
            .sessions-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            .sessions-table th, .sessions-table td {
                text-align: left;
                padding: 12px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            .sessions-table th {
                background-color: var(--vscode-panel-background);
                font-weight: bold;
            }
            .cost {
                color: var(--vscode-charts-green);
            }
            h1, h2 {
                color: var(--vscode-foreground);
            }
        </style>
    </head>
    <body>
        <h1>Claude Usage Dashboard</h1>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${stats.totalTokens.toLocaleString()}</div>
                <div class="stat-label">Total Tokens</div>
            </div>
            <div class="stat-card">
                <div class="stat-value cost">$${stats.totalCost.toFixed(4)}</div>
                <div class="stat-label">Total Cost</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.sessions}</div>
                <div class="stat-label">Sessions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.inputTokens.toLocaleString()}</div>
                <div class="stat-label">Input Tokens</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.outputTokens.toLocaleString()}</div>
                <div class="stat-label">Output Tokens</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.cacheReadTokens.toLocaleString()}</div>
                <div class="stat-label">Cache Read Tokens</div>
            </div>
        </div>

        <h2>Recent Sessions</h2>
        <table class="sessions-table">
            <thead>
                <tr>
                    <th>Project</th>
                    <th>Start Time</th>
                    <th>Model</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                    <th>Turns</th>
                </tr>
            </thead>
            <tbody>
                ${sessions.slice(0, 10).map(session => `
                    <tr>
                        <td>${session.projectName}</td>
                        <td>${new Date(session.startTime).toLocaleString()}</td>
                        <td>${session.model}</td>
                        <td>${session.totalTokens.toLocaleString()}</td>
                        <td class="cost">$${session.totalCost.toFixed(4)}</td>
                        <td>${session.turnCount}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <p style="margin-top: 30px; color: var(--vscode-descriptionForeground);">
            Data range: ${stats.dateRange.start} to ${stats.dateRange.end}
        </p>
    </body>
    </html>`;
  }

  private getDailyReportHtml(report: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily Report - ${report.date}</title>
        <style>
            body { 
                font-family: var(--vscode-font-family); 
                padding: 20px; 
                color: var(--vscode-foreground);
            }
            .summary {
                background-color: var(--vscode-panel-background);
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
                border: 1px solid var(--vscode-panel-border);
            }
            .cost { color: var(--vscode-charts-green); }
        </style>
    </head>
    <body>
        <h1>Daily Report - ${report.date}</h1>
        
        <div class="summary">
            <h3>Summary</h3>
            <p><strong>Total Tokens:</strong> ${report.stats.totalTokens.toLocaleString()}</p>
            <p><strong>Total Cost:</strong> <span class="cost">$${report.stats.totalCost.toFixed(4)}</span></p>
            <p><strong>Sessions:</strong> ${report.stats.sessions}</p>
        </div>

        <h3>Sessions</h3>
        ${report.sessions.map((session: SessionData) => `
            <div class="summary">
                <p><strong>Project:</strong> ${session.projectName}</p>
                <p><strong>Model:</strong> ${session.model}</p>
                <p><strong>Tokens:</strong> ${session.totalTokens.toLocaleString()}</p>
                <p><strong>Cost:</strong> <span class="cost">$${session.totalCost.toFixed(4)}</span></p>
                <p><strong>Duration:</strong> ${session.startTime} - ${session.endTime}</p>
            </div>
        `).join('')}
    </body>
    </html>`;
  }

  private getMonthlyReportHtml(report: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monthly Report - ${report.month}</title>
        <style>
            body { 
                font-family: var(--vscode-font-family); 
                padding: 20px; 
                color: var(--vscode-foreground);
            }
            .summary {
                background-color: var(--vscode-panel-background);
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
                border: 1px solid var(--vscode-panel-border);
            }
            .cost { color: var(--vscode-charts-green); }
            .daily-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            .daily-table th, .daily-table td {
                text-align: left;
                padding: 12px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
        </style>
    </head>
    <body>
        <h1>Monthly Report - ${report.month}</h1>
        
        <div class="summary">
            <h3>Monthly Summary</h3>
            <p><strong>Total Tokens:</strong> ${report.stats.totalTokens.toLocaleString()}</p>
            <p><strong>Total Cost:</strong> <span class="cost">$${report.stats.totalCost.toFixed(4)}</span></p>
            <p><strong>Sessions:</strong> ${report.stats.sessions}</p>
        </div>

        <h3>Daily Breakdown</h3>
        <table class="daily-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                    <th>Sessions</th>
                </tr>
            </thead>
            <tbody>
                ${report.dailyBreakdown.map((day: any) => `
                    <tr>
                        <td>${day.date}</td>
                        <td>${day.stats.totalTokens.toLocaleString()}</td>
                        <td class="cost">$${day.stats.totalCost.toFixed(4)}</td>
                        <td>${day.stats.sessions}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>`;
  }

  private getLiveSessionHtml(sessions: SessionData[]): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Live Sessions</title>
        <style>
            body { 
                font-family: var(--vscode-font-family); 
                padding: 20px; 
                color: var(--vscode-foreground);
            }
            .session {
                background-color: var(--vscode-panel-background);
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
                border: 1px solid var(--vscode-panel-border);
            }
            .active { border-color: var(--vscode-charts-green); }
            .cost { color: var(--vscode-charts-green); }
        </style>
        <script>
            setInterval(() => {
                location.reload();
            }, 5000);
        </script>
    </head>
    <body>
        <h1>Live Sessions</h1>
        <p>Active sessions in the last hour (auto-refreshes every 5 seconds)</p>
        
        ${sessions.length === 0 ? '<p>No active sessions found.</p>' : 
          sessions.map(session => `
            <div class="session active">
                <h3>${session.projectName}</h3>
                <p><strong>Model:</strong> ${session.model}</p>
                <p><strong>Started:</strong> ${new Date(session.startTime).toLocaleString()}</p>
                <p><strong>Last Activity:</strong> ${new Date(session.endTime).toLocaleString()}</p>
                <p><strong>Tokens:</strong> ${session.totalTokens.toLocaleString()}</p>
                <p><strong>Cost:</strong> <span class="cost">$${session.totalCost.toFixed(4)}</span></p>
                <p><strong>Turns:</strong> ${session.turnCount}</p>
            </div>
          `).join('')
        }
    </body>
    </html>`;
  }
}