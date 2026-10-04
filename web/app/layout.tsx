import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/app-state/AppProvider";
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
    <html lang="ja">
      <body className="min-h-dvh antialiased">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
