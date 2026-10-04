import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/app-state/AppProvider";
import { THEME_INIT_SCRIPT } from "@/ui/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "かんじ よみかた れんしゅう",
  description: "小学生のための 漢字の読みかた 4 択れんしゅうアプリ",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "かんじよみ", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f5f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme は初回描画前のスクリプトで付与するため、ハイドレーションの差分を許容する
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
