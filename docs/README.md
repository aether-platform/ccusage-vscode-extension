# GitHub Pages & スポンサーシップ設定 (Organization版)

このディレクトリには、GitHub OrganizationプロジェクトのGitHub Pagesサイトとスポンサーシップ設定が含まれています。

## GitHub Pages設定

### 有効化手順 (Organization)
1. GitHubのOrganizationリポジトリの Settings → Pages
2. Source: `Deploy from a branch`
3. Branch: `main` / `docs`
4. Save

### 必要な編集項目
以下のプレースホルダーを実際の値に置き換えてください：

#### 🎯 設定済み項目 (aether-platform)
すべてのプレースホルダーは `aether-platform` に設定済みです：

#### `index.html`
- ✅ GitHub: `https://github.com/aether-platform/ccusage-ext`
- ✅ VS Code Marketplace: `aether-platform.ccusage-ext`
- ✅ 連絡先: `contact@aether-platform.org`

#### `.github/FUNDING.yml`
- ✅ GitHub Sponsors: `aether-platform`
- ✅ Open Collective: `aether-platform`
- ✅ Ko-fi: `aether-platform`
- ✅ カスタムURL設定済み

## スポンサーシップ設定 (Organization)

### GitHub Sponsors for Organizations
1. GitHub.com → Organization Settings → Member privileges → Sponsorships
2. GitHub Sponsorsを有効化
3. Organization profile設定とスポンサーティア作成
4. `.github/FUNDING.yml`ファイルでOrganization名を設定

### Open Collective (推奨)
Organizationの場合、Open Collectiveも強く推奨されます：
- 透明性の高い財務管理
- 国際的な寄付対応
- 税控除証明書発行
- コミュニティ主導の意思決定

### スポンサーティア例
- **☕ コーヒースポンサー ($5/月)**
  - 開発継続への感謝
  - スポンサーバッジ
  
- **🚀 アクティブサポーター ($25/月)**
  - 優先機能リクエスト
  - バグ修正優先対応
  - 早期アクセス
  
- **🏢 ビジネススポンサー ($100/月)**
  - カスタム機能開発
  - 企業ロゴ掲載
  - 専用サポート

## サイト構成

```
docs/
├── index.html          # メインページ
├── style.css          # スタイルシート
├── claude-logo.svg    # ロゴファイル
└── README.md          # このファイル
```

## カスタマイズ

### デザイン
- `style.css`でカラーテーマや レイアウトを調整
- レスポンシブデザイン対応済み

### コンテンツ
- 機能説明の追加・修正
- スクリーンショットの追加
- スポンサーティアの調整

### 追加ページ
必要に応じて以下を追加：
- `docs/demo/` - デモページ
- `docs/docs/` - ドキュメント
- `docs/blog/` - ブログ

## Organization向け特記事項

### 権限管理
- Organization memberにPagesの編集権限を付与
- Sponsorshipの管理権限をOwnerまたは管理者に設定
- Repository settingsへのアクセス権限を確認

### ブランディング
- Organization logoやカラーテーマに合わせたカスタマイズ
- 複数プロジェクトとの統一感を重視
- Contributors表示やTeam情報の追加

## 🌐 公開URL (aether-platform)
設定完了後、以下でアクセス可能：
`https://aether-platform.github.io/ccusage-ext/`

### Organization Pagesの場合
Organization全体のページからもリンク可能：
`https://aether-platform.github.io/` → プロジェクト一覧

### 🚀 即座に利用可能なURL
- **GitHub Repository**: https://github.com/aether-platform/ccusage-ext
- **GitHub Pages**: https://aether-platform.github.io/ccusage-ext/
- **GitHub Sponsors**: https://github.com/sponsors/aether-platform
- **Open Collective**: https://opencollective.com/aether-platform