# Claude Code Usage Tracker - VSCode Extension Specification

## 概要
ccusageと同等の機能を持つVSCode拡張機能。Claude Codeのトークン使用量とコストをリアルタイムで追跡・分析する。

## 実行環境対応

### 対応環境
1. **Local**: ローカルファイルシステム
2. **WSL**: Windows Subsystem for Linux
3. **Remote Container**: VSCode Remote Container環境

### 実行ホスト解決機能

#### 自動検出
- `ccusage.executionHost: "auto"`（デフォルト）
- 環境変数とシステム情報から自動判定
- Remote Container → WSL → Local の優先順位

#### 手動指定
- `ccusage.executionHost: "local|wsl|container"`
- 特定環境を強制指定

### パス解決戦略

#### Local環境
```
~/.claude/projects/
~/.config/claude/projects/
```

#### WSL環境
```
# Windows側（優先）
/mnt/c/Users/{username}/.claude/projects/
/mnt/c/Users/{username}/.config/claude/projects/

# Linux側（フォールバック）
~/.claude/projects/
~/.config/claude/projects/
```

#### Remote Container環境
```
# マウントポイント
/workspace/.claude/projects/
/app/.claude/projects/
/home/vscode/.claude/projects/
/home/node/.claude/projects/

# ワークスペースフォルダ内
{workspaceFolder}/.claude/projects/
{workspaceFolder}/.config/claude/projects/
```

## 🚀 **新機能仕様: 全環境検索・合算表示**

### 機能概要
複数の実行環境にあるClaude Codeデータを横断的に検索し、統合して表示する機能。

### 実装仕様

#### 1. 全環境スキャン機能
```typescript
interface MultiEnvironmentScanner {
  scanAllEnvironments(): Promise<EnvironmentScanResult[]>;
}

interface EnvironmentScanResult {
  environment: HostEnvironment;
  validPaths: string[];
  entryCount: number;
  dataSize: number;
  lastModified: Date;
  accessible: boolean;
  errors?: string[];
}
```

#### 2. データ統合エンジン
```typescript
interface DataAggregator {
  aggregateFromMultipleSources(sources: EnvironmentScanResult[]): AggregatedData;
  deduplicateEntries(entries: ClaudeTranscriptEntry[]): ClaudeTranscriptEntry[];
  mergeUsageStats(stats: UsageStats[]): UsageStats;
}
```

#### 3. 設定オプション
```json
{
  "ccusage.enableMultiEnvironmentScan": {
    "type": "boolean",
    "default": true,
    "description": "Scan and aggregate data from all available environments"
  },
  "ccusage.excludeEnvironments": {
    "type": "array",
    "items": { "type": "string", "enum": ["local", "wsl", "container"] },
    "default": [],
    "description": "Environments to exclude from multi-environment scanning"
  },
  "ccusage.parallelScan": {
    "type": "boolean", 
    "default": true,
    "description": "Enable parallel scanning of multiple environments"
  }
}
```

#### 4. UI表示拡張

##### ダッシュボード拡張
- **環境別内訳**: 各環境からのデータ量を表示
- **統合統計**: 全環境合算の使用量・コスト
- **データソース表示**: どの環境からデータを取得したかを明示

##### 新しいコマンド
```json
{
  "command": "ccusage.scanAllEnvironments",
  "title": "Scan All Environments", 
  "category": "Claude Usage"
},
{
  "command": "ccusage.showEnvironmentBreakdown",
  "title": "Show Environment Breakdown",
  "category": "Claude Usage"
}
```

#### 5. 実装詳細

##### 環境検出の並列実行
```typescript
async function scanAllEnvironments(): Promise<EnvironmentScanResult[]> {
  const environments = [
    createLocalEnvironment(),
    createWSLEnvironment(), 
    createContainerEnvironment()
  ];
  
  const results = await Promise.allSettled(
    environments.map(env => scanEnvironment(env))
  );
  
  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);
}
```

##### グローバル重複排除
```typescript
class GlobalDeduplicator {
  private seenEntries = new Set<string>();
  
  deduplicateGlobally(entries: ClaudeTranscriptEntry[]): ClaudeTranscriptEntry[] {
    return entries.filter(entry => {
      const key = this.generateGlobalKey(entry);
      if (this.seenEntries.has(key)) {
        return false;
      }
      this.seenEntries.add(key);
      return true;
    });
  }
  
  private generateGlobalKey(entry: ClaudeTranscriptEntry): string {
    return `${entry.conversation_id}-${entry.turn_id}-${entry.timestamp}-${entry.model}`;
  }
}
```

#### 6. パフォーマンス考慮

##### キャッシュ戦略
- 環境スキャン結果のキャッシュ（5分間）
- 増分アップデート（変更検出時のみ再スキャン）
- バックグラウンド定期スキャン

##### エラーハンドリング
- 一部環境でエラーが発生しても他の環境のデータは表示
- アクセス権限エラーの適切な処理
- ネットワーク関連エラー（Remote Container）の処理

#### 7. ユーザー体験

##### 初回起動時
1. 全環境を自動スキャン
2. 見つかったデータソースを表示
3. ユーザーに利用する環境の確認

##### 通常使用時
- デフォルトで全環境のデータを統合表示
- 環境別フィルタリング機能
- リアルタイム更新（ファイル監視）

### 利点
- **完全な可視性**: どの環境のClaude Codeデータも見逃さない
- **統合ビュー**: 複数環境での作業の全体像を把握
- **環境移行対応**: 開発環境変更時もデータの連続性を保持
- **フレキシビリティ**: 必要に応じて特定環境のみフォーカス可能

### 技術的制約
- ファイルアクセス権限の制約
- Remote Container環境でのホスト側アクセス制限
- WSL環境でのWindowsファイルシステムアクセス性能

この仕様により、開発者がどの環境で作業していても、包括的なClaude Code使用状況を把握できるようになります。