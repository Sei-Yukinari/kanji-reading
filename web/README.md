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

5. 読み上げ音声を生成する(下記)。本番ビルド(`npm run build`)は音声が欠けているとエラーになる
6. 文字が増えた場合はフォントを再サブセット化する(下記)

作成中の原稿は `npx tsx scripts/check-grade.ts N` で 1 学年だけ検証できる。

### 人手チェック(NFR-012)

`npx tsx scripts/export-review.ts` で `review/`(コミットしない)に学年ごとの CSV を書き出す。

- `grade-N-readings.csv`: 漢字ごとの読み(出題する / 出題しない)
- `grade-N-questions.csv`: 全問題(問題文・下線・ルビ・正解・誤答)

どちらにも 1 回目・2 回目・指摘のチェック欄がある。指摘は `content/grade-N.yaml` に反映する。

### 読み上げ音声(FR-009)

VOICEVOX で正解の読みを事前生成し、`public/audio/{学年}/{audioId}.m4a` にコミットする。キャラクター・話速は `src/audio/voice-config.ts`(ずんだもんを仮採用。顧客の了承待ち)。

```bash
docker run -d --name voicevox -p 50021:50021 voicevox/voicevox_engine:cpu-latest
npx tsx scripts/build-audio.ts            # 全学年(既存の音声はスキップ。参照されなくなった音声は削除)
npx tsx scripts/build-audio.ts --grade 3  # 1 学年だけ
```

- ffmpeg が必要(AAC モノラル 32kbps に変換)
- VOICEVOX はひらがな 1 語でも「は」を「わ」と読むなど解析がずれることがある。生成時に解析結果を読みと照合し、ずれた場合はカナ指定で読みを固定する(固定した語は実行ログに出る)
- 音声は全件を人が聴いて確認する(NFR-012)

### フォント(T-007)

出題用の Klee One SemiBold を、問題データで使う文字だけにサブセット化して `public/fonts/` に置く。

```bash
python3 -m pip install fonttools brotli
curl -LO https://github.com/google/fonts/raw/main/ofl/kleeone/KleeOne-SemiBold.ttf
npx tsx scripts/build-font.ts --src KleeOne-SemiBold.ttf
```

新しい学年を追加するときは `content/official-kanji.yaml` に配当漢字を追記し、`content/grade-N.yaml` を作成する。

## デプロイ(Vercel)

- Vercel プロジェクトの Root Directory を `web` にする。設定は `vercel.json`(ビルドコマンド・出力先・セキュリティ/キャッシュヘッダー)
- リポジトリ直下の `vercel.json` / `middleware.ts` はドキュメントサイト用で、アプリとは別プロジェクト

## 未対応・確認待ち

- 問題データ(全学年。読み・exclude・熟語・例文・誤答)と読み上げ音声は、すべて人手チェック前の下書き(NFR-012)
- 読み上げ音声のキャラクター(ずんだもん)は仮採用。顧客の了承待ち
- 本番デプロイ(Vercel プロジェクト・独自ドメイン)は未実施
