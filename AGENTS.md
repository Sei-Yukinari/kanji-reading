# プロジェクトマネジメント・ドキュメントリポジトリ

受託開発プロジェクトの **要件定義 → 設計 → 見積もり** ドキュメントを管理するリポジトリ。ドキュメントサイトは [Blume](https://useblume.dev/) でビルド・公開する。

## ディレクトリ構成

```text
docs/
├── requirements/   # 要件定義(プロジェクト概要・要求定義・要件定義)
├── design/         # 設計(UI/UX・技術選定・アーキテクチャ・機能設計・画面遷移図・シーケンス図・ER図・API一覧・非機能設計)
└── estimate/       # 見積もり(開発費用・運用費用)
```

## ワークフロー

ドキュメントは必ず **要件定義 → 設計 → 見積もり** の順で作成する。上流を変更したら下流への影響を確認する。詳細は `.claude/rules/workflow.md` を参照。

各フェーズには専用スキルがある:

| スキル | 用途 |
| --- | --- |
| `/requirements` | ヒアリング形式で要件定義を作成 |
| `/design` | 要件を入力に設計ドキュメントを作成(技術調査は tech-researcher) |
| `/estimate` | 要件・設計を入力に見積もりを作成(工数算出は estimator) |
| `/doc-review` | 全ドキュメントの整合性レビュー(doc-reviewer) |

## 記述規約

- すべて日本語で記述する
- frontmatter(title / description)必須 — hooks で自動検証される。独自フィールドの追加は禁止(Blume がビルドから除外する)
- 進捗は本文冒頭のステータス行(`> ステータス: **draft**`)で管理する
- ID 採番(REQ-/FR-/NFR-/KPI-/PS-/UC-/BF-/SCR-/T-/API-xxx)とトレーサビリティを守る
- 詳細は `.claude/rules/documentation.md` を参照

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run docs:dev` | ドキュメントサイトの開発サーバー起動 |
| `npm run docs:build` | 静的サイトビルド(`dist/` に出力) |
| `npm run lint:md` | markdownlint 実行 |
| `npm run docs:diagrams` | docs 内の mermaid ブロックを抽出し SVG 化(`public/diagrams/`)して画像参照へ置換 |
| `npm run docs:diagrams:render` | `diagrams/src/*.mmd` を編集した後に SVG だけ再生成 |

## 注意事項

- 金額・単価・バッファ率を勝手に確定しない。工数算出まで行い、最終判断はユーザーに確認する
- ステータスが `approved` のドキュメントを変更する場合は、先にステータス行を `draft` へ戻してユーザーに知らせる
- 顧客提出前には必ず `/doc-review` を実行する
