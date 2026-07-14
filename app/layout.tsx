import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "拾光册",
  description: "翻阅值得珍藏的每一刻",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
