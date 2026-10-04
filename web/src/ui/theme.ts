// 画面の配色(ライト/ダーク)。端末ごとの設定として localStorage に保存する(既定はライト)

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "kanji-reading:theme";

/** globals.css の canvas-parchment(ステータスバーの色) */
const THEME_COLOR: Record<Theme, string> = { light: "#f5f5f7", dark: "#000000" };

export function getTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "dark") localStorage.setItem(THEME_STORAGE_KEY, "dark");
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // 保存できなくても、いまの画面には反映する
  }
  applyTheme(theme);
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

/** 初回描画前に <head> で実行し、ダーク設定時のちらつきを防ぐ */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="dark"){document.documentElement.dataset.theme="dark";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",${JSON.stringify(THEME_COLOR.dark)})}}catch(e){}`;
