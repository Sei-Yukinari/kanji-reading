import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// static export(T-001)。サーバー処理を持たない静的 PWA として配信する
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // リポジトリ直下(ドキュメントサイト)の lockfile / middleware を拾わないよう web/ を root に固定する
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};

export default nextConfig;
