import * as vscode from 'vscode';
import { AnalyticsEngine } from './analytics';
import { ClaudeTranscriptEntry, UsageStats, SessionData } from './types';

export class WebViewProvider {
  private analytics = new AnalyticsEngine();
  private dashboardPanel?: vscode.WebviewPanel;
  private dailyReportPanel?: vscode.WebviewPanel;
  private monthlyReportPanel?: vscode.WebviewPanel;
  private liveSessionPanel?: vscode.WebviewPanel;

  // データ更新時に既存のパネルを更新するメソッド
  private currentEntries: ClaudeTranscriptEntry[] = [];
  private currentView: string = 'dashboard';
  private currentDate?: string;

  updateExistingPanels(entries: ClaudeTranscriptEntry[]) {
    this.currentEntries = entries;
    
    if (this.dashboardPanel) {
      this.refreshCurrentView();
    }

    if (this.liveSessionPanel) {
      const activeSessions = this.analytics.getLiveSessionData(entries);
      this.liveSessionPanel.webview.html = this.getLiveSessionHtml(activeSessions);
    }
  }

  private refreshCurrentView() {
    if (!this.dashboardPanel) return;

    switch (this.currentView) {
      case 'dashboard':
        const stats = this.analytics.calculateUsageStats(this.currentEntries);
        const recentSessions = this.analytics.getLiveSessionData(this.currentEntries);
        this.dashboardPanel.webview.html = this.getDashboardHtml(stats, recentSessions, 'dashboard');
        break;
      case 'daily':
        const dailyReport = this.analytics.generateDailyReport(this.currentEntries, this.currentDate || new Date().toISOString().substring(0, 10));
        this.dashboardPanel.webview.html = this.getDailyReportHtml(dailyReport, true);
        break;
      case 'weekly':
        const weeklyStats = this.analytics.calculateUsageStats(this.currentEntries);
        this.dashboardPanel.webview.html = this.getDashboardHtml(weeklyStats, [], 'weekly');
        break;
      case 'monthly':
        const monthlyStats = this.analytics.calculateUsageStats(this.currentEntries);
        this.dashboardPanel.webview.html = this.getDashboardHtml(monthlyStats, [], 'monthly');
        break;
      case 'live':
        const activeSessions = this.analytics.getLiveSessionData(this.currentEntries);
        this.dashboardPanel.webview.html = this.getLiveSessionHtml(activeSessions, true);
        break;
    }
  }

  private handleWebviewMessage(message: any, entries: ClaudeTranscriptEntry[]) {
    this.currentEntries = entries;
    
    switch (message.command) {
      case 'showDashboard':
        this.currentView = 'dashboard';
        this.dashboardPanel!.title = 'Claude Usage Dashboard';
        this.refreshCurrentView();
        break;
      case 'showDaily':
        this.currentView = 'daily';
        this.currentDate = message.date || new Date().toISOString().substring(0, 10);
        this.dashboardPanel!.title = 'Claude Usage - Daily Reports';
        this.refreshCurrentView();
        break;
      case 'showWeekly':
        this.currentView = 'weekly';
        this.dashboardPanel!.title = 'Claude Usage - Weekly Reports';
        this.refreshCurrentView();
        break;
      case 'showMonthly':
        this.currentView = 'monthly';
        this.currentDate = message.month || new Date().toISOString().substring(0, 7);
        this.dashboardPanel!.title = 'Claude Usage - Monthly Reports';
        this.refreshCurrentView();
        break;
      case 'showLive':
        this.currentView = 'live';
        this.dashboardPanel!.title = 'Claude Usage - Live Sessions';
        this.refreshCurrentView();
        break;
    }
  }

  createDashboardWebView(context: vscode.ExtensionContext, entries: ClaudeTranscriptEntry[]): vscode.WebviewPanel {
    this.currentEntries = entries;
    this.currentView = 'dashboard';
    
    // 既存のダッシュボードパネルがある場合は再利用
    if (this.dashboardPanel) {
      // パネルが既に存在する場合は、内容を更新してフォーカス
      const stats = this.analytics.calculateUsageStats(entries);
      const recentSessions = this.analytics.getLiveSessionData(entries);
      this.dashboardPanel.webview.html = this.getDashboardHtml(stats, recentSessions, 'dashboard');
      this.dashboardPanel.reveal(vscode.ViewColumn.One);
      return this.dashboardPanel;
    }

    // 新しいパネルを作成
    this.dashboardPanel = vscode.window.createWebviewPanel(
      'claudeUsageDashboard',
      'Claude Usage Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    // パネルが閉じられたときの処理
    this.dashboardPanel.onDidDispose(() => {
      this.dashboardPanel = undefined;
    });

    // メッセージハンドラーを設定
    this.dashboardPanel.webview.onDidReceiveMessage((message) => {
      this.handleWebviewMessage(message, entries);
    });

    const stats = this.analytics.calculateUsageStats(entries);
    const recentSessions = this.analytics.getLiveSessionData(entries);
    
    this.dashboardPanel.webview.html = this.getDashboardHtml(stats, recentSessions, 'dashboard');
    
    return this.dashboardPanel;
  }


  createDailyReportWebView(context: vscode.ExtensionContext, entries: ClaudeTranscriptEntry[], date?: string): vscode.WebviewPanel {
    const targetDate = date || new Date().toISOString().substring(0, 10);
    const report = this.analytics.generateDailyReport(entries, targetDate);
    
    // 既存の日次レポートパネルがある場合は再利用
    if (this.dailyReportPanel) {
      this.dailyReportPanel.title = `Claude Usage - ${targetDate}`;
      this.dailyReportPanel.webview.html = this.getDailyReportHtml(report);
      this.dailyReportPanel.reveal(vscode.ViewColumn.One);
      return this.dailyReportPanel;
    }

    this.dailyReportPanel = vscode.window.createWebviewPanel(
      'claudeUsageDaily',
      `Claude Usage - ${targetDate}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    this.dailyReportPanel.onDidDispose(() => {
      this.dailyReportPanel = undefined;
    });

    this.dailyReportPanel.webview.html = this.getDailyReportHtml(report);
    
    return this.dailyReportPanel;
  }

  createMonthlyReportWebView(context: vscode.ExtensionContext, entries: ClaudeTranscriptEntry[], month?: string): vscode.WebviewPanel {
    const targetMonth = month || new Date().toISOString().substring(0, 7);
    const report = this.analytics.generateMonthlyReport(entries, targetMonth);
    
    // 既存の月次レポートパネルがある場合は再利用
    if (this.monthlyReportPanel) {
      this.monthlyReportPanel.title = `Claude Usage - ${targetMonth}`;
      this.monthlyReportPanel.webview.html = this.getMonthlyReportHtml(report);
      this.monthlyReportPanel.reveal(vscode.ViewColumn.One);
      return this.monthlyReportPanel;
    }

    this.monthlyReportPanel = vscode.window.createWebviewPanel(
      'claudeUsageMonthly',
      `Claude Usage - ${targetMonth}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    this.monthlyReportPanel.onDidDispose(() => {
      this.monthlyReportPanel = undefined;
    });

    this.monthlyReportPanel.webview.html = this.getMonthlyReportHtml(report);
    
    return this.monthlyReportPanel;
  }

  createLiveSessionWebView(context: vscode.ExtensionContext, entries: ClaudeTranscriptEntry[]): vscode.WebviewPanel {
    const activeSessions = this.analytics.getLiveSessionData(entries);
    
    // 既存のライブセッションパネルがある場合は再利用
    if (this.liveSessionPanel) {
      this.liveSessionPanel.webview.html = this.getLiveSessionHtml(activeSessions);
      this.liveSessionPanel.reveal(vscode.ViewColumn.One);
      return this.liveSessionPanel;
    }

    this.liveSessionPanel = vscode.window.createWebviewPanel(
      'claudeUsageLive',
      'Claude Usage - Live Sessions',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    this.liveSessionPanel.onDidDispose(() => {
      this.liveSessionPanel = undefined;
    });

    this.liveSessionPanel.webview.html = this.getLiveSessionHtml(activeSessions);
    
    return this.liveSessionPanel;
  }

  private getDashboardHtml(stats: UsageStats, sessions: SessionData[], activeView = 'dashboard'): string {
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
            .nav-tabs {
                display: flex;
                border-bottom: 1px solid var(--vscode-panel-border);
                margin-bottom: 20px;
                gap: 0;
            }
            .nav-tab {
                padding: 12px 24px;
                background: var(--vscode-panel-background);
                border: 1px solid var(--vscode-panel-border);
                border-bottom: none;
                cursor: pointer;
                color: var(--vscode-foreground);
                text-decoration: none;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                margin-right: -1px;
            }
            .nav-tab:hover {
                background: var(--vscode-list-hoverBackground);
            }
            .nav-tab.active {
                background: var(--vscode-editor-background);
                color: var(--vscode-charts-blue);
                border-bottom: 2px solid var(--vscode-charts-blue);
                z-index: 1;
                position: relative;
            }
            .nav-tab:first-child {
                border-top-left-radius: 6px;
            }
            .nav-tab:last-child {
                border-top-right-radius: 6px;
                margin-right: 0;
            }
            .date-inputs {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
                align-items: center;
            }
            .date-input {
                padding: 6px 12px;
                border: 1px solid var(--vscode-input-border);
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 4px;
                font-size: 13px;
            }
            .date-button {
                padding: 6px 12px;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            }
            .date-button:hover {
                background: var(--vscode-button-hoverBackground);
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
        </style>
    </head>
    <body>
        <div class="nav-tabs">
            <div class="nav-tab ${activeView === 'dashboard' ? 'active' : ''}" onclick="switchView('dashboard')">
                📊 Dashboard
            </div>
            <div class="nav-tab ${activeView === 'daily' ? 'active' : ''}" onclick="switchView('daily')">
                📅 Daily Report
            </div>
            <div class="nav-tab ${activeView === 'weekly' ? 'active' : ''}" onclick="switchView('weekly')">
                📅 Weekly Report
            </div>
            <div class="nav-tab ${activeView === 'monthly' ? 'active' : ''}" onclick="switchView('monthly')">
                📆 Monthly Report
            </div>
            <div class="nav-tab ${activeView === 'live' ? 'active' : ''}" onclick="switchView('live')">
                🔴 Live Sessions
            </div>
        </div>

        <h1>Claude Usage ${activeView === 'dashboard' ? 'Dashboard' : activeView === 'daily' ? 'Daily Report' : activeView === 'weekly' ? 'Weekly Report' : activeView === 'monthly' ? 'Monthly Report' : 'Live Sessions'}</h1>
        
        <!-- Debug Info -->
        <div class="debug-info" style="background: var(--vscode-panel-background); padding: 10px; margin: 10px 0; border-radius: 4px; font-size: 12px;">
            <strong>Debug Info:</strong> ${this.currentEntries.length} entries loaded
            ${this.currentEntries.length > 0 ? `| Latest: ${this.currentEntries[this.currentEntries.length - 1]?.timestamp || 'N/A'}` : ''}
        </div>
        
        ${activeView === 'dashboard' ? this.getTodayStatsHtml() : ''}
        
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
            ${stats.averageTokensPerSession ? `
            <div class="stat-card">
                <div class="stat-value">${Math.round(stats.averageTokensPerSession).toLocaleString()}</div>
                <div class="stat-label">Avg Tokens/Session</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Math.round(stats.medianTokensPerSession || 0).toLocaleString()}</div>
                <div class="stat-label">Median Tokens/Session</div>
            </div>
            <div class="stat-card">
                <div class="stat-value cost">$${(stats.averageCostPerSession || 0).toFixed(4)}</div>
                <div class="stat-label">Avg Cost/Session</div>
            </div>
            <div class="stat-card">
                <div class="stat-value cost">$${(stats.medianCostPerSession || 0).toFixed(4)}</div>
                <div class="stat-label">Median Cost/Session</div>
            </div>
            ` : ''}
        </div>

        ${activeView === 'daily' ? this.getDailyListHtml() : ''}
        ${activeView === 'weekly' ? this.getWeeklyListHtml() : ''}
        ${activeView === 'monthly' ? this.getMonthlyListHtml() : ''}

        ${activeView === 'dashboard' || activeView === 'live' ? `
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
        ` : ''}

        <p style="margin-top: 30px; color: var(--vscode-descriptionForeground);">
            Data range: ${stats.dateRange.start} to ${stats.dateRange.end}
        </p>

        <script>
            const vscode = acquireVsCodeApi();

            function switchView(view) {
                vscode.postMessage({
                    command: view === 'dashboard' ? 'showDashboard' : 
                             view === 'daily' ? 'showDaily' :
                             view === 'weekly' ? 'showWeekly' :
                             view === 'monthly' ? 'showMonthly' : 'showLive'
                });
            }
        </script>
    </body>
    </html>`;
  }

  private getDailyReportHtml(report: any, withNavigation = false): string {
    if (withNavigation) {
      // Use the same navigation-enabled HTML as dashboard
      const stats = report.stats;
      const sessions = report.sessions;
      return this.getDashboardHtml(stats, sessions, 'daily');
    }

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

  private getMonthlyReportHtml(report: any, withNavigation = false): string {
    if (withNavigation) {
      // Use the same navigation-enabled HTML as dashboard
      const stats = report.stats;
      return this.getDashboardHtml(stats, [], 'monthly');
    }

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

  private getLiveSessionHtml(sessions: SessionData[], withNavigation = false): string {
    if (withNavigation) {
      // Use the same navigation-enabled HTML as dashboard
      const mockStats = {
        totalTokens: sessions.reduce((sum, s) => sum + s.totalTokens, 0),
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalCost: sessions.reduce((sum, s) => sum + s.totalCost, 0),
        sessions: sessions.length,
        dateRange: { start: '', end: '' }
      };
      return this.getDashboardHtml(mockStats, sessions, 'live');
    }

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

  private getTodayStatsHtml(): string {
    const todayStats = this.analytics.getTodayStats(this.currentEntries);
    const insights = this.analytics.getUsageInsights(this.currentEntries);
    
    // Get comparison data
    const today = new Date();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay() + 1);
    const thisMonth = today.toISOString().substring(0, 7);
    
    const weeklyReport = this.analytics.generateWeeklyReport(this.currentEntries, thisWeekStart.toISOString().substring(0, 10));
    const monthlyReport = this.analytics.generateMonthlyReport(this.currentEntries, thisMonth);
    
    return `
    <div class="today-stats">
      <h2>📊 利用状況比較</h2>
      
      <!-- Comparison Grid -->
      <div class="comparison-grid">
        <div class="comparison-section">
          <h3>📅 今日</h3>
          <div class="comparison-stats">
            <div class="comparison-stat">
              <div class="comparison-value">${todayStats.totalTokens.toLocaleString()}</div>
              <div class="comparison-label">トークン</div>
            </div>
            <div class="comparison-stat">
              <div class="comparison-value cost">$${todayStats.totalCost.toFixed(4)}</div>
              <div class="comparison-label">コスト</div>
            </div>
            <div class="comparison-stat">
              <div class="comparison-value">${todayStats.sessions}</div>
              <div class="comparison-label">セッション</div>
            </div>
            <div class="comparison-stat">
              <div class="comparison-value">${Math.round(todayStats.averageTokensPerSession || 0).toLocaleString()}</div>
              <div class="comparison-label">平均/セッション</div>
            </div>
          </div>
        </div>
        
        <div class="comparison-section">
          <h3>📅 今週</h3>
          <div class="comparison-stats">
            <div class="comparison-stat">
              <div class="comparison-value">${weeklyReport.stats.totalTokens.toLocaleString()}</div>
              <div class="comparison-label">トークン</div>
            </div>
            <div class="comparison-stat">
              <div class="comparison-value cost">$${weeklyReport.stats.totalCost.toFixed(4)}</div>
              <div class="comparison-label">コスト</div>
            </div>
            <div class="comparison-stat">
              <div class="comparison-value">${weeklyReport.stats.sessions}</div>
              <div class="comparison-label">セッション</div>
            </div>
            <div class="comparison-stat">
              <div class="comparison-value">${Math.round(weeklyReport.stats.averageTokensPerSession || 0).toLocaleString()}</div>
              <div class="comparison-label">平均/セッション</div>
            </div>
          </div>
        </div>
        
        <div class="comparison-section">
          <h3>📆 今月</h3>
          <div class="comparison-stats">
            <div class="comparison-stat">
              <div class="comparison-value">${monthlyReport.stats.totalTokens.toLocaleString()}</div>
              <div class="comparison-label">トークン</div>
            </div>
            <div class="comparison-stat">
              <div class="comparison-value cost">$${monthlyReport.stats.totalCost.toFixed(4)}</div>
              <div class="comparison-label">コスト</div>
            </div>
            <div class="comparison-stat">
              <div class="comparison-value">${monthlyReport.stats.sessions}</div>
              <div class="comparison-label">セッション</div>
            </div>
            <div class="comparison-stat">
              <div class="comparison-value">${Math.round(monthlyReport.stats.averageTokensPerSession || 0).toLocaleString()}</div>
              <div class="comparison-label">平均/セッション</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="insights-card">
        <h3>💡 利用状況分析</h3>
        <p>${insights}</p>
      </div>
    </div>
    
    <style>
      .today-stats {
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
      }
      .comparison-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
        margin-bottom: 20px;
      }
      .comparison-section {
        background: var(--vscode-panel-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 16px;
      }
      .comparison-section h3 {
        margin: 0 0 15px 0;
        color: var(--vscode-charts-blue);
        font-size: 16px;
        text-align: center;
        border-bottom: 1px solid var(--vscode-panel-border);
        padding-bottom: 8px;
      }
      .comparison-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .comparison-stat {
        text-align: center;
        padding: 8px;
        background: var(--vscode-editor-background);
        border-radius: 4px;
        border: 1px solid var(--vscode-input-border);
      }
      .comparison-value {
        font-size: 18px;
        font-weight: bold;
        color: var(--vscode-charts-green);
        margin-bottom: 4px;
      }
      .comparison-value.cost {
        color: var(--vscode-charts-orange);
      }
      .comparison-label {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .insights-card {
        background: var(--vscode-panel-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        padding: 15px;
      }
      .insights-card h3 {
        margin: 0 0 10px 0;
        color: var(--vscode-charts-blue);
        font-size: 16px;
      }
      .insights-card p {
        margin: 0;
        line-height: 1.5;
        color: var(--vscode-foreground);
      }
    </style>
    `;
  }

  private getDailyListHtml(): string {
    const dailyReports = this.analytics.getRecentDays(this.currentEntries, 30);
    
    return `
    <div class="list-container">
      <h2>📅 Daily Reports (Last 30 Days)</h2>
      <table class="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Sessions</th>
            <th>Avg/Session</th>
            <th>Median/Session</th>
          </tr>
        </thead>
        <tbody>
          ${dailyReports.map(report => `
            <tr>
              <td>${report.date}</td>
              <td>${report.stats.totalTokens.toLocaleString()}</td>
              <td class="cost">$${report.stats.totalCost.toFixed(4)}</td>
              <td>${report.stats.sessions}</td>
              <td>${Math.round(report.stats.averageTokensPerSession || 0).toLocaleString()}</td>
              <td>${Math.round(report.stats.medianTokensPerSession || 0).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <style>
      .list-container {
        margin: 20px 0;
      }
      .report-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
      }
      .report-table th, .report-table td {
        text-align: left;
        padding: 10px 12px;
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      .report-table th {
        background-color: var(--vscode-panel-background);
        font-weight: bold;
        font-size: 13px;
      }
      .report-table tr:hover {
        background-color: var(--vscode-list-hoverBackground);
      }
    </style>
    `;
  }

  private getWeeklyListHtml(): string {
    const weeklyReports = this.analytics.getRecentWeeks(this.currentEntries, 12);
    
    return `
    <div class="list-container">
      <h2>📅 Weekly Reports (Last 12 Weeks)</h2>
      <table class="report-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Sessions</th>
            <th>Avg/Session</th>
            <th>Median/Session</th>
          </tr>
        </thead>
        <tbody>
          ${weeklyReports.map(report => `
            <tr>
              <td>${report.weekStart} - ${report.weekEnd}</td>
              <td>${report.stats.totalTokens.toLocaleString()}</td>
              <td class="cost">$${report.stats.totalCost.toFixed(4)}</td>
              <td>${report.stats.sessions}</td>
              <td>${Math.round(report.stats.averageTokensPerSession || 0).toLocaleString()}</td>
              <td>${Math.round(report.stats.medianTokensPerSession || 0).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `;
  }

  private getMonthlyListHtml(): string {
    const monthlyReports = this.analytics.getRecentMonths(this.currentEntries, 12);
    
    return `
    <div class="list-container">
      <h2>📆 Monthly Reports (Last 12 Months)</h2>
      <table class="report-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Sessions</th>
            <th>Avg/Session</th>
            <th>Median/Session</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyReports.map(report => `
            <tr>
              <td>${report.month}</td>
              <td>${report.stats.totalTokens.toLocaleString()}</td>
              <td class="cost">$${report.stats.totalCost.toFixed(4)}</td>
              <td>${report.stats.sessions}</td>
              <td>${Math.round(report.stats.averageTokensPerSession || 0).toLocaleString()}</td>
              <td>${Math.round(report.stats.medianTokensPerSession || 0).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `;
  }
}