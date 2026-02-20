// ============================================================
// 2조 2교대 스케줄 계산 로직
// 기준: 매주 월요일 주간/야간 교대
// A조 기준 짝수 주차 = 주간, 홀수 주차 = 야간
// ============================================================

export type ShiftType = "주간" | "야간" | "휴일";

/**
 * 특정 날짜에 특정 조의 근무 유형을 계산합니다.
 * @param date - 조회할 날짜
 * @param group - "A조" 또는 "B조"
 * @returns "주간" | "야간" | "휴일"
 */
export function getShiftType(date: Date, group: "A조" | "B조"): ShiftType {
  const dayOfWeek = date.getDay(); // 0=일, 6=토

  // 주말은 휴일
  if (dayOfWeek === 0 || dayOfWeek === 6) return "휴일";

  // 기준일: 2024-01-01 (월요일, A조 주간 시작)
  const baseDate = new Date(2024, 0, 1);
  const diffDays = Math.floor((date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7);

  // A조: 짝수 주차=주간, 홀수 주차=야간
  const aIsDay = weekNumber % 2 === 0;

  if (group === "A조") return aIsDay ? "주간" : "야간";
  else return aIsDay ? "야간" : "주간";
}

/**
 * 특정 월의 전체 스케줄을 생성합니다.
 */
export function generateMonthSchedule(
  year: number,
  month: number, // 1~12
  workers: { id: string; name: string; group_name: "A조" | "B조" }[]
) {
  const schedules: {
    worker_id: string;
    schedule_date: string;
    shift_type: ShiftType;
    status: "scheduled";
  }[] = [];

  const daysInMonth = new Date(year, month, 0).getDate();

  for (const worker of workers) {
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const shiftType = getShiftType(date, worker.group_name);
      schedules.push({
        worker_id: worker.id,
        schedule_date: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        shift_type: shiftType,
        status: "scheduled",
      });
    }
  }

  return schedules;
}

/**
 * 오늘 근무 중인 조와 근무 유형을 반환합니다.
 */
export function getTodayShiftInfo(): { aShift: ShiftType; bShift: ShiftType } {
  const today = new Date();
  return {
    aShift: getShiftType(today, "A조"),
    bShift: getShiftType(today, "B조"),
  };
}

/**
 * 근무 시작/종료 시간을 반환합니다.
 */
export function getShiftHours(shiftType: ShiftType) {
  if (shiftType === "주간") return { start: "08:00", end: "20:00" };
  if (shiftType === "야간") return { start: "20:00", end: "08:00" };
  return { start: "-", end: "-" };
}
