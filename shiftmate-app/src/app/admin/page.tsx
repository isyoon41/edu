"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getTodayShiftInfo, getShiftHours } from "@/lib/schedule";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, checkedIn: 0, absent: 0 });
  const [recentAtt, setRecentAtt] = useState<any[]>([]);
  const today = new Date().toISOString().split("T")[0];
  const { aShift, bShift } = getTodayShiftInfo();
  const nowStr = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const { count: total } = await supabase
      .from("workers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    const { count: checkedIn } = await supabase
      .from("attendances")
      .select("*", { count: "exact", head: true })
      .gte("check_in_at", `${today}T00:00:00`);

    const { data: recent } = await supabase
      .from("attendances")
      .select("id, check_in_at, check_out_at, status, workers(name, group_name)")
      .gte("check_in_at", `${today}T00:00:00`)
      .order("check_in_at", { ascending: false })
      .limit(8);

    setStats({ total: total ?? 0, checkedIn: checkedIn ?? 0, absent: 0 });
    setRecentAtt(recent ?? []);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">관리자 대시보드</h1>
          <p className="text-gray-400 text-sm">{today} · {nowStr}</p>
        </div>
        <Link href="/" className="text-blue-600 text-sm">홈으로</Link>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* 오늘 근무 요약 */}
        <div className="grid grid-cols-2 gap-3">
          <ShiftCard group="A조" shift={aShift} />
          <ShiftCard group="B조" shift={bShift} />
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="전체 직원" value={stats.total} color="text-gray-800" />
          <StatCard label="오늘 출근" value={stats.checkedIn} color="text-green-600" />
          <StatCard label="미체크인" value={stats.total - stats.checkedIn} color="text-orange-500" />
        </div>

        {/* 관리 메뉴 */}
        <div className="grid grid-cols-2 gap-3">
          <MenuCard href="/admin/workers" icon="👥" title="직원 관리" desc="직원 추가/수정/삭제" />
          <MenuCard href="/admin/schedule" icon="📅" title="스케줄 관리" desc="월별 스케줄 생성" />
          <MenuCard href="/admin/attendance" icon="✅" title="출결 현황" desc="오늘/이번달 출결" />
          <MenuCard href="/admin/export" icon="📊" title="보고서 출력" desc="월별 출결 요약" />
        </div>

        {/* 오늘 출결 기록 */}
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-3">오늘 출결 기록</h2>
          {recentAtt.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">오늘 체크인 기록이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {recentAtt.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="font-medium text-gray-800">{a.workers?.name}</span>
                    <span className="text-gray-400 text-xs ml-2">{a.workers?.group_name}</span>
                  </div>
                  <div className="text-right text-sm">
                    <span className="text-green-600">
                      {new Date(a.check_in_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 출근
                    </span>
                    {a.check_out_at && (
                      <span className="text-gray-400 ml-2">
                        {new Date(a.check_out_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 퇴근
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShiftCard({ group, shift }: { group: string; shift: string }) {
  const hours = getShiftHours(shift as any);
  const bg = shift === "주간" ? "bg-yellow-50 border-yellow-200" : shift === "야간" ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200";
  const badge = shift === "주간" ? "badge-day" : shift === "야간" ? "badge-night" : "badge-off";
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-gray-700">{group}</span>
        <span className={badge}>{shift}</span>
      </div>
      {shift !== "휴일" && <p className="text-xs text-gray-500">{hours.start} ~ {hours.end}</p>}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card text-center py-4">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-gray-400 text-xs mt-1">{label}</p>
    </div>
  );
}

function MenuCard({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card flex items-start gap-3 hover:border-blue-300 hover:shadow-md transition-all">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <p className="text-gray-400 text-xs mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}
