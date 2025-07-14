import * as vscode from 'vscode';
import { AnalyticsEngine } from './analytics';
import { ClaudeTranscriptEntry, UsageStats, SessionData } from './types';

export class WebViewProvider {
  private analytics = new AnalyticsEngine();
  private dashboardPanel?: vscode.WebviewPanel;
  private dailyReportPanel?: vscode.WebviewPanel;
  private monthlyReportPanel?: vscode.WebviewPanel;
  private liveSessionPanel?: vscode.WebviewPanel;
  private sponsorPanel?: vscode.WebviewPanel;

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
      case 'blocks':
        this.dashboardPanel.webview.html = this.getDashboardHtml(this.analytics.calculateUsageStats(this.currentEntries), [], 'blocks');
        break;
      case 'models':
        this.dashboardPanel.webview.html = this.getDashboardHtml(this.analytics.calculateUsageStats(this.currentEntries), [], 'models');
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
      case 'connectToWSL':
        vscode.commands.executeCommand('remote-wsl.newWindow');
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
      case 'showBlocks':
        this.currentView = 'blocks';
        this.dashboardPanel!.title = 'Claude Usage - 5h Billing Blocks';
        this.refreshCurrentView();
        break;
      case 'showModels':
        this.currentView = 'models';
        this.dashboardPanel!.title = 'Claude Usage - Model Usage';
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
    const isWindows = process.platform === 'win32';
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
            <div class="nav-tab ${activeView === 'blocks' ? 'active' : ''}" onclick="switchView('blocks')">
                ⏰ 5h Blocks
            </div>
            <div class="nav-tab ${activeView === 'models' ? 'active' : ''}" onclick="switchView('models')">
                🤖 Models
            </div>
            <div class="nav-tab ${activeView === 'live' ? 'active' : ''}" onclick="switchView('live')">
                🔴 Live Sessions
            </div>
        </div>

        <h1>Claude Usage ${activeView === 'dashboard' ? 'Dashboard' : activeView === 'daily' ? 'Daily Report' : activeView === 'weekly' ? 'Weekly Report' : activeView === 'monthly' ? 'Monthly Report' : activeView === 'blocks' ? '5h Billing Blocks' : activeView === 'models' ? 'Model Usage' : 'Live Sessions'}</h1>
        
        <!-- Debug Info -->
        <div class="debug-info" style="background: var(--vscode-panel-background); padding: 10px; margin: 10px 0; border-radius: 4px; font-size: 12px;">
            <strong>Debug Info:</strong> ${this.currentEntries.length} entries loaded
            ${this.currentEntries.length > 0 ? `| Latest: ${this.currentEntries[this.currentEntries.length - 1]?.timestamp || 'N/A'}` : ''}
        </div>
        
        ${activeView === 'dashboard' ? this.getTodayStatsHtml() : ''}
        
        ${stats.totalTokens === 0 ? `
        <div style="background-color: var(--vscode-inputValidation-warningBackground); border: 1px solid var(--vscode-inputValidation-warningBorder); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: var(--vscode-inputValidation-warningForeground);">⚠️ Claude使用データが見つかりません</h3>
            <p style="margin-bottom: 10px;">Claude Codeの使用履歴が見つかりませんでした。以下を確認してください：</p>
            <ul style="margin-bottom: 10px;">
                <li>Claude Codeがインストールされていること</li>
                <li>Claude Codeを使用したことがあること</li>
                <li>.claudeディレクトリが正しい場所にあること</li>
                ${isWindows ? '<li><strong>Windowsユーザーの方へ</strong>: WSL環境でVS Codeを使用することで、Claude Codeとの統合が改善される可能性があります</li>' : ''}
            </ul>
            <p style="margin-bottom: 10px;">環境設定を確認するには、コマンドパレットから「Show Claude Environment Status」を実行してください。</p>
            ${isWindows ? `
            <p style="margin: 0;">
                <button onclick="vscode.postMessage({command: 'connectToWSL'})" style="padding: 6px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer;">
                    WSLに接続
                </button>
            </p>
            ` : ''}
        </div>
        ` : ''}
        
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
        ${activeView === 'blocks' ? this.getBillingBlocksHtml() : ''}
        ${activeView === 'models' ? this.getModelUsageHtml() : ''}

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
                             view === 'monthly' ? 'showMonthly' :
                             view === 'blocks' ? 'showBlocks' :
                             view === 'models' ? 'showModels' : 'showLive'
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
    
    // Calculate daily averages
    const daysInWeek = today.getDay() || 7; // If Sunday (0), use 7
    const daysInMonth = today.getDate();
    
    const weeklyDailyAvg = {
      tokens: Math.round(weeklyReport.stats.totalTokens / daysInWeek),
      cost: weeklyReport.stats.totalCost / daysInWeek,
      sessions: weeklyReport.stats.sessions / daysInWeek
    };
    
    const monthlyDailyAvg = {
      tokens: Math.round(monthlyReport.stats.totalTokens / daysInMonth),
      cost: monthlyReport.stats.totalCost / daysInMonth,
      sessions: monthlyReport.stats.sessions / daysInMonth
    };
    
    // Calculate percentages compared to averages
    const weeklyComparison = {
      tokens: weeklyDailyAvg.tokens > 0 ? Math.round((todayStats.totalTokens / weeklyDailyAvg.tokens - 1) * 100) : 0,
      cost: weeklyDailyAvg.cost > 0 ? Math.round((todayStats.totalCost / weeklyDailyAvg.cost - 1) * 100) : 0,
      sessions: weeklyDailyAvg.sessions > 0 ? Math.round((todayStats.sessions / weeklyDailyAvg.sessions - 1) * 100) : 0
    };
    
    const monthlyComparison = {
      tokens: monthlyDailyAvg.tokens > 0 ? Math.round((todayStats.totalTokens / monthlyDailyAvg.tokens - 1) * 100) : 0,
      cost: monthlyDailyAvg.cost > 0 ? Math.round((todayStats.totalCost / monthlyDailyAvg.cost - 1) * 100) : 0,
      sessions: monthlyDailyAvg.sessions > 0 ? Math.round((todayStats.sessions / monthlyDailyAvg.sessions - 1) * 100) : 0
    };
    
    const formatComparison = (value: number) => {
      if (value > 0) return `<span class="trend-up">+${value}%</span>`;
      if (value < 0) return `<span class="trend-down">${value}%</span>`;
      return `<span class="trend-neutral">±0%</span>`;
    };
    
    return `
    <div class="today-stats">
      <h2>📊 利用状況比較</h2>
      
      <!-- Enhanced Comparison Table -->
      <table class="comparison-table-enhanced">
        <thead>
          <tr>
            <th>指標</th>
            <th class="highlight-today">📅 今日</th>
            <th>週平均/日</th>
            <th>週平均比</th>
            <th>月平均/日</th>
            <th>月平均比</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="metric-name">💬 トークン数</td>
            <td class="highlight-today">${todayStats.totalTokens.toLocaleString()}</td>
            <td>${weeklyDailyAvg.tokens.toLocaleString()}</td>
            <td>${formatComparison(weeklyComparison.tokens)}</td>
            <td>${monthlyDailyAvg.tokens.toLocaleString()}</td>
            <td>${formatComparison(monthlyComparison.tokens)}</td>
          </tr>
          <tr>
            <td class="metric-name">💰 コスト</td>
            <td class="highlight-today cost">$${todayStats.totalCost.toFixed(4)}</td>
            <td class="cost">$${weeklyDailyAvg.cost.toFixed(4)}</td>
            <td>${formatComparison(weeklyComparison.cost)}</td>
            <td class="cost">$${monthlyDailyAvg.cost.toFixed(4)}</td>
            <td>${formatComparison(monthlyComparison.cost)}</td>
          </tr>
          <tr>
            <td class="metric-name">📊 セッション数</td>
            <td class="highlight-today">${todayStats.sessions}</td>
            <td>${weeklyDailyAvg.sessions.toFixed(1)}</td>
            <td>${formatComparison(weeklyComparison.sessions)}</td>
            <td>${monthlyDailyAvg.sessions.toFixed(1)}</td>
            <td>${formatComparison(monthlyComparison.sessions)}</td>
          </tr>
          <tr>
            <td class="metric-name">⚡ 効率性</td>
            <td class="highlight-today">${Math.round(todayStats.averageTokensPerSession || 0).toLocaleString()}</td>
            <td>${Math.round(weeklyReport.stats.averageTokensPerSession || 0).toLocaleString()}</td>
            <td>-</td>
            <td>${Math.round(monthlyReport.stats.averageTokensPerSession || 0).toLocaleString()}</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>
      
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card">
          <h4>📅 今週の状況 (${daysInWeek}日間)</h4>
          <div class="summary-content">
            <div>合計: ${weeklyReport.stats.totalTokens.toLocaleString()} トークン</div>
            <div class="cost">合計: $${weeklyReport.stats.totalCost.toFixed(2)}</div>
            <div>予測月額: $${(weeklyReport.stats.totalCost / daysInWeek * 30).toFixed(2)}</div>
          </div>
        </div>
        <div class="summary-card">
          <h4>📆 今月の状況 (${daysInMonth}日間)</h4>
          <div class="summary-content">
            <div>合計: ${monthlyReport.stats.totalTokens.toLocaleString()} トークン</div>
            <div class="cost">合計: $${monthlyReport.stats.totalCost.toFixed(2)}</div>
            <div>予測月末: $${(monthlyReport.stats.totalCost / daysInMonth * 30).toFixed(2)}</div>
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
      .comparison-table-enhanced {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 14px;
      }
      .comparison-table-enhanced th,
      .comparison-table-enhanced td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      .comparison-table-enhanced th {
        background: var(--vscode-panel-background);
        font-weight: bold;
        color: var(--vscode-charts-blue);
        font-size: 13px;
      }
      .comparison-table-enhanced th.highlight-today {
        background: var(--vscode-charts-blue);
        color: var(--vscode-editor-background);
      }
      .comparison-table-enhanced td.highlight-today {
        background: rgba(var(--vscode-charts-blue), 0.1);
        font-weight: bold;
      }
      .metric-name {
        font-weight: 500;
        color: var(--vscode-foreground);
      }
      .trend-up {
        color: var(--vscode-charts-green);
        font-weight: bold;
      }
      .trend-down {
        color: var(--vscode-charts-red);
        font-weight: bold;
      }
      .trend-neutral {
        color: var(--vscode-descriptionForeground);
      }
      .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
      }
      .summary-card {
        background: var(--vscode-panel-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 6px;
        padding: 15px;
      }
      .summary-card h4 {
        margin: 0 0 10px 0;
        color: var(--vscode-charts-blue);
        font-size: 14px;
      }
      .summary-content div {
        margin: 5px 0;
        font-size: 13px;
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
      .cost {
        color: var(--vscode-charts-orange);
      }
    </style>
    `;
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

  private calculatePeriodStats(reports: any[]): any {
    const validReports = reports.filter(r => r.stats.sessions > 0);
    const tokens = validReports.map(r => r.stats.totalTokens);
    const costs = validReports.map(r => r.stats.totalCost);
    const avgTokens = validReports.map(r => r.stats.averageTokensPerSession || 0);
    
    return {
      avgTokens: tokens.length > 0 ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length) : 0,
      medianTokens: Math.round(this.calculateMedian(tokens)),
      avgCost: costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0,
      medianCost: this.calculateMedian(costs),
      avgSessionEfficiency: avgTokens.length > 0 ? Math.round(avgTokens.reduce((a, b) => a + b, 0) / avgTokens.length) : 0,
      medianSessionEfficiency: Math.round(this.calculateMedian(avgTokens))
    };
  }

  private getDailyListHtml(): string {
    const dailyReports = this.analytics.getRecentDays(this.currentEntries, 30);
    const weeklyReports = this.analytics.getRecentWeeks(this.currentEntries, 12);
    const monthlyReports = this.analytics.getRecentMonths(this.currentEntries, 12);
    
    // Calculate statistics for each period
    const dailyStats = this.calculatePeriodStats(dailyReports);
    const weeklyStats = this.calculatePeriodStats(weeklyReports);
    const monthlyStats = this.calculatePeriodStats(monthlyReports);
    
    return `
    <div class="list-container">
      <h2>📅 Daily Reports (Last 30 Days)</h2>
      
      <!-- Comparison Statistics Table -->
      <div class="comparison-summary">
        <h3>📊 期間比較統計</h3>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>期間</th>
              <th>平均トークン</th>
              <th>中央値トークン</th>
              <th>平均コスト</th>
              <th>中央値コスト</th>
              <th>平均セッション効率</th>
              <th>中央値セッション効率</th>
            </tr>
          </thead>
          <tbody>
            <tr class="daily-row" style="background-color: var(--vscode-list-activeSelectionBackground) !important;">
              <td><strong>📅 日次 (30日) ← 現在のビュー</strong></td>
              <td>${dailyStats.avgTokens.toLocaleString()}</td>
              <td>${dailyStats.medianTokens.toLocaleString()}</td>
              <td class="cost">$${dailyStats.avgCost.toFixed(4)}</td>
              <td class="cost">$${dailyStats.medianCost.toFixed(4)}</td>
              <td>${dailyStats.avgSessionEfficiency.toLocaleString()}</td>
              <td>${dailyStats.medianSessionEfficiency.toLocaleString()}</td>
            </tr>
            <tr class="weekly-row">
              <td><strong>📅 週次 (12週)</strong></td>
              <td>${weeklyStats.avgTokens.toLocaleString()}</td>
              <td>${weeklyStats.medianTokens.toLocaleString()}</td>
              <td class="cost">$${weeklyStats.avgCost.toFixed(4)}</td>
              <td class="cost">$${weeklyStats.medianCost.toFixed(4)}</td>
              <td>${weeklyStats.avgSessionEfficiency.toLocaleString()}</td>
              <td>${weeklyStats.medianSessionEfficiency.toLocaleString()}</td>
            </tr>
            <tr class="monthly-row">
              <td><strong>📆 月次 (12ヶ月)</strong></td>
              <td>${monthlyStats.avgTokens.toLocaleString()}</td>
              <td>${monthlyStats.medianTokens.toLocaleString()}</td>
              <td class="cost">$${monthlyStats.avgCost.toFixed(4)}</td>
              <td class="cost">$${monthlyStats.medianCost.toFixed(4)}</td>
              <td>${monthlyStats.avgSessionEfficiency.toLocaleString()}</td>
              <td>${monthlyStats.medianSessionEfficiency.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
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
          ${dailyReports.slice().reverse().map(report => `
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
    
    ${this.getSharedStyles()}
    `;
  }

  private getWeeklyListHtml(): string {
    const dailyReports = this.analytics.getRecentDays(this.currentEntries, 30);
    const weeklyReports = this.analytics.getRecentWeeks(this.currentEntries, 12);
    const monthlyReports = this.analytics.getRecentMonths(this.currentEntries, 12);
    
    // Calculate statistics for each period
    const dailyStats = this.calculatePeriodStats(dailyReports);
    const weeklyStats = this.calculatePeriodStats(weeklyReports);
    const monthlyStats = this.calculatePeriodStats(monthlyReports);
    
    return `
    <div class="list-container">
      <h2>📅 Weekly Reports (Last 12 Weeks)</h2>
      
      <!-- Comparison Statistics Table -->
      <div class="comparison-summary">
        <h3>📊 期間比較統計</h3>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>期間</th>
              <th>平均トークン</th>
              <th>中央値トークン</th>
              <th>平均コスト</th>
              <th>中央値コスト</th>
              <th>平均セッション効率</th>
              <th>中央値セッション効率</th>
            </tr>
          </thead>
          <tbody>
            <tr class="daily-row">
              <td><strong>📅 日次 (30日)</strong></td>
              <td>${dailyStats.avgTokens.toLocaleString()}</td>
              <td>${dailyStats.medianTokens.toLocaleString()}</td>
              <td class="cost">$${dailyStats.avgCost.toFixed(4)}</td>
              <td class="cost">$${dailyStats.medianCost.toFixed(4)}</td>
              <td>${dailyStats.avgSessionEfficiency.toLocaleString()}</td>
              <td>${dailyStats.medianSessionEfficiency.toLocaleString()}</td>
            </tr>
            <tr class="weekly-row" style="background-color: var(--vscode-list-activeSelectionBackground) !important;">
              <td><strong>📅 週次 (12週) ← 現在のビュー</strong></td>
              <td>${weeklyStats.avgTokens.toLocaleString()}</td>
              <td>${weeklyStats.medianTokens.toLocaleString()}</td>
              <td class="cost">$${weeklyStats.avgCost.toFixed(4)}</td>
              <td class="cost">$${weeklyStats.medianCost.toFixed(4)}</td>
              <td>${weeklyStats.avgSessionEfficiency.toLocaleString()}</td>
              <td>${weeklyStats.medianSessionEfficiency.toLocaleString()}</td>
            </tr>
            <tr class="monthly-row">
              <td><strong>📆 月次 (12ヶ月)</strong></td>
              <td>${monthlyStats.avgTokens.toLocaleString()}</td>
              <td>${monthlyStats.medianTokens.toLocaleString()}</td>
              <td class="cost">$${monthlyStats.avgCost.toFixed(4)}</td>
              <td class="cost">$${monthlyStats.medianCost.toFixed(4)}</td>
              <td>${monthlyStats.avgSessionEfficiency.toLocaleString()}</td>
              <td>${monthlyStats.medianSessionEfficiency.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
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
          ${weeklyReports.slice().reverse().map(report => `
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
    
    ${this.getSharedStyles()}
    `;
  }

  private getMonthlyListHtml(): string {
    const dailyReports = this.analytics.getRecentDays(this.currentEntries, 30);
    const weeklyReports = this.analytics.getRecentWeeks(this.currentEntries, 12);
    const monthlyReports = this.analytics.getRecentMonths(this.currentEntries, 12);
    
    // Calculate statistics for each period
    const dailyStats = this.calculatePeriodStats(dailyReports);
    const weeklyStats = this.calculatePeriodStats(weeklyReports);
    const monthlyStats = this.calculatePeriodStats(monthlyReports);
    
    return `
    <div class="list-container">
      <h2>📆 Monthly Reports (Last 12 Months)</h2>
      
      <!-- Comparison Statistics Table -->
      <div class="comparison-summary">
        <h3>📊 期間比較統計</h3>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>期間</th>
              <th>平均トークン</th>
              <th>中央値トークン</th>
              <th>平均コスト</th>
              <th>中央値コスト</th>
              <th>平均セッション効率</th>
              <th>中央値セッション効率</th>
            </tr>
          </thead>
          <tbody>
            <tr class="daily-row">
              <td><strong>📅 日次 (30日)</strong></td>
              <td>${dailyStats.avgTokens.toLocaleString()}</td>
              <td>${dailyStats.medianTokens.toLocaleString()}</td>
              <td class="cost">$${dailyStats.avgCost.toFixed(4)}</td>
              <td class="cost">$${dailyStats.medianCost.toFixed(4)}</td>
              <td>${dailyStats.avgSessionEfficiency.toLocaleString()}</td>
              <td>${dailyStats.medianSessionEfficiency.toLocaleString()}</td>
            </tr>
            <tr class="weekly-row">
              <td><strong>📅 週次 (12週)</strong></td>
              <td>${weeklyStats.avgTokens.toLocaleString()}</td>
              <td>${weeklyStats.medianTokens.toLocaleString()}</td>
              <td class="cost">$${weeklyStats.avgCost.toFixed(4)}</td>
              <td class="cost">$${weeklyStats.medianCost.toFixed(4)}</td>
              <td>${weeklyStats.avgSessionEfficiency.toLocaleString()}</td>
              <td>${weeklyStats.medianSessionEfficiency.toLocaleString()}</td>
            </tr>
            <tr class="monthly-row" style="background-color: var(--vscode-list-activeSelectionBackground) !important;">
              <td><strong>📆 月次 (12ヶ月) ← 現在のビュー</strong></td>
              <td>${monthlyStats.avgTokens.toLocaleString()}</td>
              <td>${monthlyStats.medianTokens.toLocaleString()}</td>
              <td class="cost">$${monthlyStats.avgCost.toFixed(4)}</td>
              <td class="cost">$${monthlyStats.medianCost.toFixed(4)}</td>
              <td>${monthlyStats.avgSessionEfficiency.toLocaleString()}</td>
              <td>${monthlyStats.medianSessionEfficiency.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
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
          ${monthlyReports.slice().reverse().map(report => `
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
    
    ${this.getSharedStyles()}
    `;
  }

  private getBillingBlocksHtml(): string {
    const blocks = this.analytics.getBillingBlocks(this.currentEntries, 10);
    
    return `
    <div class="list-container">
      <h2>⏰ 5時間課金ブロック (最新10個)</h2>
      
      ${blocks.length === 0 ? `
        <div style="text-align: center; padding: 40px; color: var(--vscode-descriptionForeground);">
          まだ課金ブロックはありません。Claude Codeを使い始めると表示されます。
        </div>
      ` : `
        ${blocks.map((block, index) => `
          <div class="block-card ${block.isActive ? 'active-block' : 'inactive-block'}">
            <div class="block-header">
              <h3>${block.isActive ? '🟢 アクティブブロック' : '⚪ 完了済みブロック'} #${index + 1}</h3>
              <div class="block-time">
                ${new Date(block.startTime).toLocaleString()} - ${new Date(block.endTime).toLocaleString()}
              </div>
            </div>
            
            <div class="block-stats">
              <div class="block-stat">
                <div class="block-stat-value">${block.totalTokens.toLocaleString()}</div>
                <div class="block-stat-label">総トークン数</div>
              </div>
              <div class="block-stat">
                <div class="block-stat-value cost">$${block.totalCost.toFixed(4)}</div>
                <div class="block-stat-label">総コスト</div>
              </div>
              <div class="block-stat">
                <div class="block-stat-value">${block.sessions.length}</div>
                <div class="block-stat-label">セッション数</div>
              </div>
              ${block.isActive ? `
                <div class="block-stat">
                  <div class="block-stat-value">${Math.floor(block.remainingTime / 60)}h ${block.remainingTime % 60}m</div>
                  <div class="block-stat-label">残り時間</div>
                </div>
                <div class="block-stat">
                  <div class="block-stat-value">${block.tokenRate.toLocaleString()}/min</div>
                  <div class="block-stat-label">トークンレート</div>
                </div>
                <div class="block-stat">
                  <div class="block-stat-value cost">$${block.projectedCost.toFixed(4)}</div>
                  <div class="block-stat-label">予想最終コスト</div>
                </div>
              ` : ''}
            </div>
            
            ${block.sessions.length > 0 ? `
              <details class="block-sessions">
                <summary>セッション詳細 (${block.sessions.length}個)</summary>
                <table class="sessions-table">
                  <thead>
                    <tr>
                      <th>プロジェクト</th>
                      <th>開始時刻</th>
                      <th>モデル</th>
                      <th>トークン</th>
                      <th>コスト</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${block.sessions.map(session => `
                      <tr>
                        <td>${session.projectName}</td>
                        <td>${new Date(session.startTime).toLocaleString()}</td>
                        <td>${session.model}</td>
                        <td>${session.totalTokens.toLocaleString()}</td>
                        <td class="cost">$${session.totalCost.toFixed(4)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </details>
            ` : ''}
          </div>
        `).join('')}
      `}
    </div>
    
    ${this.getSharedStyles()}
    <style>
      .block-card {
        background: var(--vscode-panel-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        margin: 15px 0;
        padding: 20px;
      }
      .active-block {
        border-color: var(--vscode-charts-green);
        background: rgba(var(--vscode-charts-green), 0.05);
      }
      .inactive-block {
        border-color: var(--vscode-panel-border);
      }
      .block-header h3 {
        margin: 0 0 5px 0;
        color: var(--vscode-charts-blue);
      }
      .block-time {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 15px;
      }
      .block-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 15px;
        margin-bottom: 15px;
      }
      .block-stat {
        text-align: center;
        padding: 10px;
        background: var(--vscode-editor-background);
        border-radius: 4px;
        border: 1px solid var(--vscode-input-border);
      }
      .block-stat-value {
        font-size: 16px;
        font-weight: bold;
        color: var(--vscode-charts-green);
        margin-bottom: 4px;
      }
      .block-stat-label {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .block-sessions {
        margin-top: 15px;
      }
      .block-sessions summary {
        cursor: pointer;
        font-weight: bold;
        color: var(--vscode-charts-blue);
        margin-bottom: 10px;
      }
      .block-sessions .sessions-table {
        margin-top: 10px;
        font-size: 12px;
      }
    </style>
    `;
  }

  private getModelUsageHtml(): string {
    const modelStats = this.analytics.getModelUsageStats(this.currentEntries);
    const totalTokens = modelStats.reduce((sum, stat) => sum + stat.totalTokens, 0);
    
    return `
    <div class="list-container">
      <h2>🤖 モデル別使用状況</h2>
      
      ${modelStats.length === 0 ? `
        <div style="text-align: center; padding: 40px; color: var(--vscode-descriptionForeground);">
          まだモデルの使用データがありません。Claude Codeを使い始めると表示されます。
        </div>
      ` : `
        <!-- Overview Cards -->
        <div class="model-overview">
          <div class="overview-card">
            <div class="overview-value">${modelStats.length}</div>
            <div class="overview-label">使用中モデル数</div>
          </div>
          <div class="overview-card">
            <div class="overview-value">${totalTokens.toLocaleString()}</div>
            <div class="overview-label">総トークン数</div>
          </div>
          <div class="overview-card">
            <div class="overview-value">${modelStats[0]?.model.replace(/claude-/, '').replace(/-/g, ' ') || 'N/A'}</div>
            <div class="overview-label">最多使用モデル</div>
          </div>
        </div>
        
        <!-- Model Usage Chart -->
        <div class="model-chart">
          ${modelStats.map((stat, index) => `
            <div class="model-bar">
              <div class="model-info">
                <div class="model-name">${stat.model}</div>
                <div class="model-percentage">${stat.percentage.toFixed(1)}%</div>
              </div>
              <div class="model-bar-container">
                <div class="model-bar-fill" style="width: ${stat.percentage}%; background-color: hsl(${index * 60}, 70%, 50%);"></div>
              </div>
              <div class="model-details">
                <span>${stat.totalTokens.toLocaleString()} tokens</span>
                <span class="cost">$${stat.totalCost.toFixed(4)}</span>
                <span>${stat.sessions} sessions</span>
              </div>
            </div>
          `).join('')}
        </div>
        
        <!-- Detailed Table -->
        <table class="model-table">
          <thead>
            <tr>
              <th>モデル</th>
              <th>使用率</th>
              <th>総トークン数</th>
              <th>総コスト</th>
              <th>セッション数</th>
              <th>セッション平均</th>
            </tr>
          </thead>
          <tbody>
            ${modelStats.map((stat, index) => `
              <tr>
                <td>
                  <div style="display: flex; align-items: center;">
                    <div style="width: 12px; height: 12px; background-color: hsl(${index * 60}, 70%, 50%); border-radius: 50%; margin-right: 8px;"></div>
                    ${stat.model}
                  </div>
                </td>
                <td>${stat.percentage.toFixed(1)}%</td>
                <td>${stat.totalTokens.toLocaleString()}</td>
                <td class="cost">$${stat.totalCost.toFixed(4)}</td>
                <td>${stat.sessions}</td>
                <td>${stat.sessions > 0 ? Math.round(stat.totalTokens / stat.sessions).toLocaleString() : '0'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
    
    ${this.getSharedStyles()}
    <style>
      .model-overview {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 25px;
      }
      .overview-card {
        background: var(--vscode-panel-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 20px;
        text-align: center;
      }
      .overview-value {
        font-size: 24px;
        font-weight: bold;
        color: var(--vscode-charts-blue);
        margin-bottom: 5px;
      }
      .overview-label {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .model-chart {
        background: var(--vscode-panel-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 25px;
      }
      .model-bar {
        margin-bottom: 15px;
        padding: 10px 0;
      }
      .model-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 5px;
      }
      .model-name {
        font-weight: bold;
        color: var(--vscode-foreground);
      }
      .model-percentage {
        font-size: 14px;
        color: var(--vscode-charts-blue);
        font-weight: bold;
      }
      .model-bar-container {
        height: 8px;
        background: var(--vscode-input-background);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 5px;
      }
      .model-bar-fill {
        height: 100%;
        transition: width 0.3s ease;
      }
      .model-details {
        display: flex;
        gap: 15px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
      .model-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
      }
      .model-table th, .model-table td {
        text-align: left;
        padding: 12px;
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      .model-table th {
        background-color: var(--vscode-panel-background);
        font-weight: bold;
        font-size: 13px;
        color: var(--vscode-charts-blue);
      }
      .model-table tr:hover {
        background-color: var(--vscode-list-hoverBackground);
      }
    </style>
    `;
  }

  private getSharedStyles(): string {
    return `
    <style>
      .list-container {
        margin: 20px 0;
      }
      .comparison-summary {
        background: var(--vscode-panel-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
      }
      .comparison-summary h3 {
        margin: 0 0 15px 0;
        color: var(--vscode-charts-blue);
        font-size: 16px;
        text-align: center;
      }
      .comparison-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0;
        font-size: 13px;
      }
      .comparison-table th, .comparison-table td {
        text-align: center;
        padding: 12px 8px;
        border-bottom: 1px solid var(--vscode-panel-border);
        border-right: 1px solid var(--vscode-panel-border);
      }
      .comparison-table th {
        background-color: var(--vscode-editor-background);
        font-weight: bold;
        font-size: 12px;
        color: var(--vscode-charts-blue);
      }
      .comparison-table td:first-child {
        text-align: left;
        font-weight: 500;
      }
      .comparison-table th:last-child, .comparison-table td:last-child {
        border-right: none;
      }
      .daily-row {
        background-color: var(--vscode-editor-background);
      }
      .weekly-row {
        background-color: rgba(var(--vscode-charts-blue), 0.05);
      }
      .monthly-row {
        background-color: rgba(var(--vscode-charts-purple), 0.05);
      }
      .comparison-table tr:hover {
        background-color: var(--vscode-list-hoverBackground) !important;
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
      .cost {
        color: var(--vscode-charts-green);
      }
    </style>
    `;
  }


  createSponsorWebView(context: vscode.ExtensionContext): vscode.WebviewPanel {
    // 既存のスポンサーパネルがある場合は再利用
    if (this.sponsorPanel) {
      this.sponsorPanel.reveal(vscode.ViewColumn.One);
      return this.sponsorPanel;
    }

    this.sponsorPanel = vscode.window.createWebviewPanel(
      'ccusageSponsor',
      '💖 Support Claude Usage Tracker',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'resources')]
      }
    );

    // パネルが閉じられたときのクリーンアップ
    this.sponsorPanel.onDidDispose(() => {
      this.sponsorPanel = undefined;
    });

    this.sponsorPanel.webview.html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Support This Project</title>
        <style>
            body { 
                font-family: var(--vscode-font-family); 
                padding: 20px; 
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                line-height: 1.6;
            }
            .sponsor-card {
                background: var(--vscode-panel-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
            }
            .sponsor-title {
                font-size: 24px;
                color: var(--vscode-charts-blue);
                margin-bottom: 10px;
            }
            .sponsor-description {
                color: var(--vscode-descriptionForeground);
                margin-bottom: 20px;
            }
            .sponsor-links {
                display: flex;
                gap: 15px;
                justify-content: center;
                flex-wrap: wrap;
            }
            .sponsor-link {
                padding: 10px 20px;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                text-decoration: none;
                border-radius: 6px;
                border: none;
                cursor: pointer;
                font-size: 14px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            .sponsor-link:hover {
                background: var(--vscode-button-hoverBackground);
            }
        </style>
    </head>
    <body>
        <h1>💖 Support This Project</h1>
        
        <div class="sponsor-card">
            <div class="sponsor-title">💖 Claude Usage Trackerを支援</div>
            <div class="sponsor-description">
                このプロジェクトがお役に立ちましたら、開発継続のためのご支援をお願いします。<br>
                100%無料のオープンソースプロジェクトとして、皆様のサポートが開発を支えています。
            </div>
            <div class="sponsor-links">
                <a href="https://github.com/sponsors/aether-platform" class="sponsor-link">
                    ❤️ GitHub Sponsorsで支援
                </a>
                <a href="https://opencollective.com/aether-platform" class="sponsor-link">
                    🌍 Open Collective
                </a>
                <a href="https://ko-fi.com/aether-platform" class="sponsor-link">
                    ☕ Ko-fi
                </a>
                <a href="https://github.com/aether-platform/ccusage-ext" class="sponsor-link">
                    ⭐ GitHubでスター
                </a>
            </div>
        </div>
        
        <div class="sponsor-card">
            <div class="sponsor-title">🚀 提供している価値</div>
            <div class="sponsor-description">
                • リアルタイムClaude Code使用量追跡<br>
                • 詳細な統計分析（平均値・中央値）<br>
                • 日次・週次・月次レポート<br>
                • 全Claudeモデルのコスト追跡<br>
                • $300プランの投資対効果分析<br>
                • WSL・Remote Container対応<br>
                • 美しいダッシュボードと比較ビュー
            </div>
        </div>
        
        <div class="sponsor-card">
            <div class="sponsor-title">💎 スポンサーティア</div>
            <div class="sponsor-description">
                <strong>☕ コーヒースポンサー ($5/月)</strong> - 開発継続への感謝<br>
                <strong>🚀 アクティブサポーター ($25/月)</strong> - 優先サポート・早期アクセス<br>
                <strong>🏢 ビジネススポンサー ($100/月)</strong> - カスタム機能・企業ロゴ掲載<br><br>
                <em>支援は任意です。プロジェクトは引き続き無料でご利用いただけます。</em>
            </div>
        </div>
        
        <div class="sponsor-card">
            <div class="sponsor-title">🛠️ フィードバック & 貢献</div>
            <div class="sponsor-description">
                バグ報告や機能要望がございましたら、お気軽にお知らせください！<br>
                コントリビューションも大歓迎です。
            </div>
            <div class="sponsor-links">
                <a href="https://github.com/aether-platform/ccusage-ext/issues" class="sponsor-link">
                    🐛 バグ報告
                </a>
                <a href="https://github.com/aether-platform/ccusage-ext/pulls" class="sponsor-link">
                    🔧 貢献する
                </a>
                <a href="https://aether-platform.github.io/ccusage-ext/" class="sponsor-link">
                    🌐 プロジェクトサイト
                </a>
            </div>
        </div>
    </body>
    </html>`;

    return this.sponsorPanel;
  }
}