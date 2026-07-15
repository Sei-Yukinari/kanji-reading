# project-management-starter

受託開発プロジェクトの **要件定義 → 設計 → 見積もり** ドキュメントを、Claude Code で効率的に作成・管理するためのボイラープレートです。ドキュメントサイトは [Blume](https://useblume.dev/) でビルドします。

## セットアップ

```bash
npm install
npm run docs:dev   # http://localhost:4321 (ポートは起動ログ参照)
```

新しいプロジェクトで使うときは、以下を書き換えてください:

1. `blume.config.ts` — `title` / `description` / `deployment.site`
2. `package.json` — `name` / `description`
3. `.mcp.json` — `blume-docs` の URL(ドキュメントサイト公開後。下記参照)

## ディレクトリ構成

```text
├── docs/                        # ドキュメント本体(Blume がサイト化)
│   ├── requirements/            # 要件定義(概要・要求定義・要件定義)
│   ├── design/                  # 設計(UI/UX・技術選定・アーキテクチャ)
│   └── estimate/                # 見積もり(開発費用・運用費用)
├── .claude/
│   ├── settings.json            # hooks 設定
│   ├── hooks/check-docs.sh      # frontmatter 検証 + markdownlint
│   ├── rules/                   # 書式・ワークフロールール
│   ├── skills/                  # /requirements /design /estimate /doc-review
│   └── agents/                  # tech-researcher / estimator / doc-reviewer
├── .mcp.json                    # MCP 設定(context7 + blume-docs)
├── AGENTS.md                    # Claude Code 向けプロジェクト指示書
├── CLAUDE.md                    # AGENTS.md へのインポート
└── blume.config.ts              # Blume 設定
```

## 使い方(Claude Code)

プロジェクトのフェーズに合わせてスキルを実行します:

```text
/requirements   # 1. ヒアリング形式で要件定義を作成
/design         # 2. 要件を入力に設計ドキュメントを作成
/estimate       # 3. 要件・設計を入力に見積もりを作成
/doc-review     # 4. 顧客提出前の整合性チェック
```

- ドキュメントには ID(REQ-/FR-/NFR-/SCR-/T-xxx)を採番し、上下流でトレーサビリティを保ちます
- `docs/` 配下の md を編集すると hooks が frontmatter 検証と markdownlint を自動実行します
- 未記入箇所は `{/* TODO: ... */}`、進捗は各ページ冒頭のステータス行(`> ステータス: **draft | review | approved**`)で管理します

## ドキュメントサイトのビルド・公開

```bash
npm run docs:build   # dist/ に静的サイトを出力
```

`dist/` を任意のホスティング(Cloudflare Pages, Vercel, S3 等)にデプロイしてください。Blume は `llms.txt` の自動生成と、URL に `.md` を付けた raw Markdown 配信に対応しています。

### Blume MCP の接続

ドキュメントサイト公開後、`.mcp.json` の `blume-docs` の URL を実際の公開 URL に書き換えると、Claude Code から公開ドキュメントを検索・参照できます:

```json
"blume-docs": {
  "type": "http",
  "url": "https://<公開したドキュメントのドメイン>/mcp"
}
```

## Lint

```bash
npm run lint:md
```

ルールは `.markdownlint.jsonc` で調整できます(日本語ドキュメント向けに MD013 等を無効化済み)。
