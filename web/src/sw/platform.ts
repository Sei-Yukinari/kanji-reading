// ホーム画面追加の案内(FR-020)のための端末判定

export type InstallPlatform = "ios" | "android" | "desktop";

export function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // iPadOS は Mac として振る舞うため、タッチ対応で判定する
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** ホーム画面に追加したアプリとして起動しているか */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iOS / iPadOS の Safari タブで開いているか(ホーム画面アプリとストレージが分かれる) */
export function isIOSBrowserTab(): boolean {
  return detectPlatform() === "ios" && !isStandalone();
}
