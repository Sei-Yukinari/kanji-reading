# かんじ よみかた れんしゅう(アプリ本体)

小学生向け漢字読み学習アプリ(静的 PWA)。要件・設計はリポジトリ直下の `docs/` を正とする。

## 技術構成

| レイヤー | 採用 | 設計 |
| --- | --- | --- |
| フロントエンド | Next.js 16(App Router)static export + TypeScript | T-001 |
| PWA | Serwist(`next build` 後の `out/` に injectManifest) | T-002 |
| 端末内ストレージ | IndexedDB(Dexie.js) | T-003 |
| 効果音 | Web Audio API(音源ファイルなしで合成) | T-005 |
| スタイリング | Tailwind CSS 4(`app/globals.css` に DESIGN.md のトークン) | T-008 |
| テスト | Vitest(単体・問題データ検証)+ Playwright(E2E) | T-009 |

## ディレクトリ

| パス | 内容 |
| --- | --- |
| `app/` | 画面(SCR-001〜SCR-010) |
| `src/engine/` | 出題エンジン(UI 非依存の純粋 TypeScript) |
| `src/store/` | 学習データストア(Dexie) |
| `src/data/` | 問題データの型・原稿変換・検証・ローダー |
| `src/audio/` | サウンドプレイヤー |
| `src/sw/` | Service Worker・端末判定 |
| `src/config.ts` | 仮置きの設計パラメータ(問題数・表示時間・習得基準 等) |
| `content/` | 問題データ原稿(YAML)・配当表・公開済み問題 ID のロック(初回リリース時に作成) |
| `scripts/` | 問題データ生成・Service Worker 生成・アイコン生成 |
| `e2e/` | Playwright の E2E テスト |

## コマンド

```bash
npm install
npm run dev          # 開発サーバー(問題データを生成してから next dev。Service Worker は無効)
npm test             # 単体テスト + 問題データ検証
npm run build        # 問題データ生成 → テスト → next build → Service Worker 生成(out/)
npm start            # out/ をローカル配信(http://localhost:3000)
npm run test:e2e     # E2E(事前に npm run build。初回は npx playwright install chromium webkit)
npm run typecheck
```

## 問題データの更新

1. `content/grade-N.yaml` を編集する(記法はファイル冒頭のコメント参照)
2. `npm run data:build` で生成・検証する。検証エラーがあると生成されない(ビルドも失敗する)
3. リリース時は `npm run data:build -- --lock` で公開済み問題 ID を `content/question-ids.lock.json` に記録する
   - ロックは初回リリース時に作成する。人手チェック前(現在)はロックを置かず、読みや熟語の修正で問題 ID が変わっても検証エラーにしない
   - 公開済みの問題を削除する場合は `content/removed-question-ids.yaml` に ID を列挙する
4. 単漢字問題の誤答は、同学年の他の漢字の読みから自動生成される。出題しない読み(例: 木 の「こ」)が誤答に混ざらないよう、`exclude` に常用漢字表の残りの音訓を列挙する

新しい学年を追加するときは `content/official-kanji.yaml` に配当漢字を追記し、`content/grade-N.yaml` を作成する。

## デプロイ(Vercel)

- Vercel プロジェクトの Root Directory を `web` にする。設定は `vercel.json`(ビルドコマンド・出力先・セキュリティ/キャッシュヘッダー)
- リポジトリ直下の `vercel.json` / `middleware.ts` はドキュメントサイト用で、アプリとは別プロジェクト

## MVP の範囲

Epic #1 を参照。MVP に含めないもの:

- 読み上げ音声(FR-009。VOICEVOX のキャラクター選定後に実装。設定画面のトグルは「じゅんびちゅう」)
- 2〜6 年生の問題データと、問題データの人手チェック(NFR-012)。1 年生のデータ(読み・exclude・熟語・例文・誤答)も人手チェック前
- Klee One のサブセット同梱(T-007)。現在は OS の教科書体・明朝体へフォールバック
