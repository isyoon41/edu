import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShiftMate - 교대근무 관리",
  description: "2조 2교대 스케줄 및 출결 관리 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
