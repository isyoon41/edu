"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Step = "name" | "pin" | "confirm" | "done";

export default function CheckInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [searchName, setSearchName] = useState("");
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [pin, setPin] = useState("");
  const [checkType, setCheckType] = useState<"in" | "out">("in");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const nowStr = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  // 이름으로 직원 검색
  async function searchWorker() {
    if (!searchName.trim()) return;
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("workers")
      .select("id, name, group_name, role")
      .ilike("name", `%${searchName}%`)
      .eq("is_active", true)
      .limit(5);

    if (error || !data?.length) {
      setError("직원을 찾을 수 없습니다. 이름을 다시 확인하세요.");
    } else {
      setWorkers(data);
    }
    setLoading(false);
  }

  // PIN 입력
  function handlePinInput(digit: string) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      verifyPin(next);
    }
  }

  // PIN 검증 + 오늘 출결 상태 확인
  async function verifyPin(enteredPin: string) {
    setLoading(true);
    setError("");

    // PIN 검증 (실제 프로덕션에서는 서버사이드에서 bcrypt 비교 필요)
    const { data: worker } = await supabase
      .from("workers")
      .select("pin_hash")
      .eq("id", selectedWorker.id)
      .single();

    if (!worker || worker.pin_hash !== enteredPin) {
      setError("PIN이 올바르지 않습니다.");
      setPin("");
      setLoading(false);
      return;
    }

    // 오늘 출결 기록 확인
    const today = new Date().toISOString().split("T")[0];
    const { data: att } = await supabase
      .from("attendances")
      .select("id, check_in_at, check_out_at")
      .eq("worker_id", selectedWorker.id)
      .gte("check_in_at", `${today}T00:00:00`)
      .order("check_in_at", { ascending: false })
      .limit(1)
      .single();

    if (!att || !att.check_in_at) {
      setCheckType("in");
    } else if (att.check_in_at && !att.check_out_at) {
      setCheckType("out");
    } else {
      setError("오늘 출퇴근이 이미 완료되었습니다.");
      setLoading(false);
      return;
    }

    setStep("confirm");
    setLoading(false);
  }

  // 최종 체크인/체크아웃 기록
  async function submitCheckIn() {
    setLoading(true);
    const now = new Date().toISOString();
    const today = now.split("T")[0];

    if (checkType === "in") {
      // 오늘 스케줄 찾기
      const { data: schedule } = await supabase
        .from("shift_schedules")
        .select("id, shift_type")
        .eq("worker_id", selectedWorker.id)
        .eq("schedule_date", today)
        .single();

      await supabase.from("attendances").insert({
        worker_id: selectedWorker.id,
        schedule_id: schedule?.id ?? null,
        check_in_at: now,
        status: "정상",
      });
    } else {
      // 체크아웃: 오늘 마지막 출결 기록 업데이트
      const { data: att } = await supabase
        .from("attendances")
        .select("id, check_in_at")
        .eq("worker_id", selectedWorker.id)
        .gte("check_in_at", `${today}T00:00:00`)
        .order("check_in_at", { ascending: false })
        .limit(1)
        .single();

      if (att) {
        const checkInTime = new Date(att.check_in_at);
        const checkOutTime = new Date(now);
        const diffMin = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);

        await supabase
          .from("attendances")
          .update({ check_out_at: now, overtime_minutes: Math.max(0, diffMin - 720) })
          .eq("id", att.id);
      }
    }

    setStep("done");
    setLoading(false);
  }

  // ── UI 렌더링 ──

  if (step === "done") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-green-700 flex flex-col items-center justify-center p-4">
        <div className="text-white text-center">
          <div className="text-7xl mb-4">✅</div>
          <h2 className="text-3xl font-bold">{checkType === "in" ? "출근 완료!" : "퇴근 완료!"}</h2>
          <p className="text-green-100 mt-2 text-lg">{selectedWorker.name}님 {nowStr}</p>
          <button onClick={() => router.push("/")} className="mt-8 bg-white text-green-700 font-bold py-3 px-8 rounded-xl">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="card w-full max-w-sm text-center">
          <div className="text-5xl mb-4">{checkType === "in" ? "👋" : "🏠"}</div>
          <h2 className="text-2xl font-bold text-gray-800">
            {checkType === "in" ? "출근 체크인" : "퇴근 체크아웃"}
          </h2>
          <div className="bg-gray-50 rounded-xl p-4 my-4">
            <p className="text-lg font-semibold text-gray-800">{selectedWorker.name}</p>
            <p className="text-gray-500">{selectedWorker.group_name}</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{nowStr}</p>
          </div>
          <button onClick={submitCheckIn} disabled={loading}
            className="w-full btn-primary text-lg mt-2">
            {loading ? "처리 중..." : `${checkType === "in" ? "출근" : "퇴근"} 확인`}
          </button>
          <button onClick={() => { setStep("name"); setPin(""); setSelectedWorker(null); }}
            className="w-full btn-secondary mt-3">
            취소
          </button>
        </div>
      </div>
    );
  }

  if (step === "pin") {
    const digits = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="card w-full max-w-sm">
          <button onClick={() => { setStep("name"); setPin(""); }} className="text-gray-400 mb-4">← 뒤로</button>
          <h2 className="text-xl font-bold text-gray-800 mb-1">PIN 입력</h2>
          <p className="text-gray-500 text-sm mb-6">{selectedWorker.name}님의 4자리 PIN을 입력하세요</p>

          <div className="flex justify-center gap-3 mb-6">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-2xl
                ${i < pin.length ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"}`}>
                {i < pin.length ? "●" : ""}
              </div>
            ))}
          </div>

          {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

          <div className="grid grid-cols-3 gap-3">
            {digits.map((d, i) => (
              <button key={i}
                onClick={() => {
                  if (d === "⌫") setPin(p => p.slice(0,-1));
                  else if (d) handlePinInput(d);
                }}
                disabled={loading || d === ""}
                className={`h-14 rounded-xl text-xl font-semibold transition-colors
                  ${d === "" ? "invisible" : "bg-gray-100 hover:bg-gray-200 text-gray-800 active:bg-gray-300"}`}>
                {d}
              </button>
            ))}
          </div>
          {loading && <p className="text-center text-gray-400 mt-4">확인 중...</p>}
        </div>
      </div>
    );
  }

  // step === "name"
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <button onClick={() => router.push("/")} className="text-gray-400 mb-4">← 뒤로</button>
        <h2 className="text-xl font-bold text-gray-800 mb-1">이름 검색</h2>
        <p className="text-gray-500 text-sm mb-4">이름을 입력하고 검색하세요</p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchName}
            onChange={e => { setSearchName(e.target.value); setWorkers([]); setError(""); }}
            onKeyDown={e => e.key === "Enter" && searchWorker()}
            placeholder="예: 홍길동"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
          <button onClick={searchWorker} disabled={loading}
            className="btn-primary px-5">
            검색
          </button>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {workers.length > 0 && (
          <div className="space-y-2">
            {workers.map(w => (
              <button key={w.id}
                onClick={() => { setSelectedWorker(w); setStep("pin"); setError(""); }}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <div className="text-left">
                  <p className="font-semibold text-gray-800">{w.name}</p>
                  <p className="text-gray-400 text-sm">{w.group_name} · {w.role === "line_leader" ? "조장" : "작업자"}</p>
                </div>
                <span className="text-blue-400">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
