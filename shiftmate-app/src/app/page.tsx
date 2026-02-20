"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getTodayShiftInfo, getShiftHours } from "@/lib/schedule";

export default function HomePage() {
  const router = useRouter();
  const today = new Date();
  const { aShift, bShift } = getTodayShiftInfo();

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${dayNames[today.getDay()]})`;
  const nowStr = today.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col items-center justify-center p-4">
      {/* 로고 */}
      <div className="text-white text-center mb-8">
        <div className="text-5xl mb-2">⏰</div>
        <h1 className="text-3xl font-bold">ShiftMate</h1>
        <p className="text-blue-200 mt-1">교대근무 관리 시스템</p>
      </div>

      {/* 오늘 날짜/시간 */}
      <div className="card w-full max-w-sm text-center mb-4">
        <p className="text-gray-500 text-sm">{todayStr}</p>
        <p className="text-4xl font-bold text-gray-800 mt-1">{nowStr}</p>
      </div>

      {/* 오늘 근무 현황 */}
      <div className="card w-full max-w-sm mb-6">
        <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-3">
          오늘 근무 현황
        </h2>
        <div className="space-y-2">
          <ShiftRow group="A조" shift={aShift} />
          <ShiftRow group="B조" shift={bShift} />
        </div>
      </div>

      {/* 버튼 */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => router.push("/checkin")}
          className="w-full btn-primary text-lg py-4"
        >
          ✋ 출퇴근 체크인
        </button>
        <button
          onClick={() => router.push("/admin")}
          className="w-full btn-secondary text-sm"
        >
          🔒 관리자 메뉴
        </button>
      </div>
    </div>
  );
}

function ShiftRow({ group, shift }: { group: string; shift: string }) {
  const hours = getShiftHours(shift as any);
  const badgeClass = shift === "주간" ? "badge-day" : shift === "야간" ? "badge-night" : "badge-off";

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">{group}</span>
        <span className={badgeClass}>{shift}</span>
      </div>
      {shift !== "휴일" && (
        <span className="text-xs text-gray-400">{hours.start} ~ {hours.end}</span>
      )}
    </div>
  );
}
