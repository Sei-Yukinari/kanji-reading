// 読み上げ音声の事前取得(docs/design/03-architecture.mdx「配信データの構成とキャッシュ戦略」)。
// 選択中の学年を優先して取得し、その後、残りの学年を順に取得する。
// 取得したファイルは Service Worker のランタイムキャッシュ(audio)に保存され、オフラインでも再生できる。

import type { GradeData, Manifest } from "../data/types";
import { voiceUrl } from "./sound";

const CONCURRENCY = 4;
let running: Promise<void> | null = null;
let stopped = false;

async function cachedUrls(): Promise<Set<string>> {
  if (typeof caches === "undefined") return new Set();
  try {
    const cache = await caches.open("audio");
    return new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  } catch {
    return new Set();
  }
}

async function fetchAll(urls: string[]) {
  const queue = [...urls];
  const worker = async () => {
    for (let u = queue.shift(); u && !stopped; u = queue.shift()) {
      if (!navigator.onLine) return;
      try {
        await fetch(u);
      } catch {
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/**
 * 音声をバックグラウンドで取得する。Service Worker が制御していない(開発時など)場合は何もしない。
 * loadGrade は問題データの取得関数(学年ごとの audioId を知るため)。
 */
export function prefetchVoices(manifest: Manifest, firstGrade: number, loadGrade: (g: number) => Promise<GradeData>): void {
  if (running || typeof navigator === "undefined" || !navigator.serviceWorker) return;
  if (!navigator.serviceWorker.controller) {
    // 初回訪問時は Service Worker がページを制御し始めてから取得する
    navigator.serviceWorker.addEventListener("controllerchange", () => prefetchVoices(manifest, firstGrade, loadGrade), { once: true });
    return;
  }
  stopped = false;
  const grades = [firstGrade, ...manifest.grades.map((g) => g.grade).filter((g) => g !== firstGrade)];
  running = (async () => {
    const have = await cachedUrls();
    for (const g of grades) {
      if (stopped) break;
      try {
        const data = await loadGrade(g);
        const urls = [...new Set(data.questions.map((q) => voiceUrl(g, q.audioId)))].filter((u) => !have.has(u));
        await fetchAll(urls);
      } catch {
        // オフライン等。次回起動時に続きから取得する
      }
    }
  })().finally(() => {
    running = null;
  });
}

let kukuRunning = false;

/** 九九の唱えの音声(81 本)をバックグラウンドで取得する(FR-029)。オフラインでも鳴らせるようにする */
export function prefetchUrls(urls: readonly string[]): void {
  if (kukuRunning || typeof navigator === "undefined" || !navigator.serviceWorker) return;
  if (!navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener("controllerchange", () => prefetchUrls(urls), { once: true });
    return;
  }
  kukuRunning = true;
  void (async () => {
    const have = await cachedUrls();
    await fetchAll(urls.filter((u) => !have.has(u)));
  })().finally(() => {
    kukuRunning = false;
  });
}

export function stopPrefetchVoices(): void {
  stopped = true;
}
