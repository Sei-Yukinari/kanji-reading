import { defineConfig } from "blume";

export default defineConfig({
  // プロジェクト名に書き換えてください
  title: "プロジェクトドキュメント",
  description: "要件定義・設計・見積もりのプロジェクトマネジメントドキュメント",
  content: {
    root: "docs",
  },
  theme: {
    accent: "teal",
    radius: "md",
    mode: "system",
  },
  search: {
    provider: "orama",
  },
  markdown: {
    imageZoom: true,
    code: {
      icons: true,
      wrap: false,
    },
  },
  seo: {
    sitemap: true,
    robots: true,
  },
  deployment: {
    output: "static",
    // 公開先が決まったら書き換えてください(Blume MCP / llms.txt のURLにも使われます)
    site: "https://docs.example.com",
  },
});
