# ドキュメント書式ルール

docs/ 配下のドキュメントを作成・編集する際は、以下のルールに従うこと。

## frontmatter

すべての md/mdx ファイルに以下の frontmatter を必ず付ける(hooks で検証される):

```yaml
---
title: ページタイトル
description: 1行の説明文
---
```

**注意**: Blume は frontmatter に独自フィールドを許可しない(`status` 等を追加するとビルドから除外される)。title / description / draft / hidden など Blume 標準フィールド以外は使わないこと。

## ステータス管理

進捗は frontmatter ではなく、本文冒頭のステータス行で管理する:

```markdown
> ステータス: **draft**
```

- `draft`(作成中)→ `review`(レビュー依頼中)→ `approved`(承認済み)の順に更新する
- `approved` のドキュメントを変更する場合は、変更前に `draft` へ戻す

## 記述スタイル

- 日本語・ですます調ではなく、簡潔な「である調・体言止め」で統一する(表・箇条書き中心)
- 見出しレベルはスキップしない(h2 の次は h3)
- 図は mermaid で記述する(flowchart / erDiagram / sequenceDiagram)。画像は補助的に使用
- 日付は `YYYY/MM/DD`、金額は `¥1,000,000` または `1,000,000 円`(税抜/税込を明記)
- 未記入箇所は `<!-- TODO: ... -->` コメントで残し、記入例は「例:」プレフィックスを付ける

## ID 採番規則

| ID | 対象 | 定義場所 |
| --- | --- | --- |
| REQ-xxx | 顧客要求 | docs/requirements/02-user-requirements.md |
| FR-xxx | 機能要件 | docs/requirements/03-system-requirements.md |
| NFR-xxx | 非機能要件 | docs/requirements/03-system-requirements.md |
| SCR-xxx | 画面 | docs/design/01-ui-ux.md |
| T-xxx | 技術選定の比較表 | docs/design/02-tech-stack.md |

- ID は 001 から連番で採番し、削除しても欠番を再利用しない
- ID を参照するときは定義場所へのリンクではなく ID 表記のみで良い(検索可能性を優先)
