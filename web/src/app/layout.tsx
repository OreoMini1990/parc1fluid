import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "병원 오더 · 인센티브 · 재고",
  description: "수액·주사 오더 파싱 및 정산",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
