/// <reference lib="webworker" />
// Service Worker(T-002: Serwist)。アプリ本体と問題データを precache し、オフラインで動作させる(FR-019, NFR-003)。
// scripts/build-sw.ts が next build 後の out/ に対して precache マニフェストを注入する。

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    // Next.js のクライアント遷移が付ける ?_rsc= 等のパラメータを無視して precache から返す
    ignoreURLParametersMatching: [/.*/],
    // 存在しない URL は起動画面(SCR-003 へ振り分け)を返す
    navigateFallback: "/index.html",
  },
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      // 読み上げ音声(API-003)は取得したものから端末に保持する(FR-009 実装時に使用)
      matcher: ({ url }) => url.pathname.startsWith("/audio/"),
      handler: new CacheFirst({
        cacheName: "audio",
        plugins: [new ExpirationPlugin({ maxEntries: 10000 })],
      }),
    },
  ],
});

serwist.addEventListeners();
