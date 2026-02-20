// ============================================================
// ShiftMate - 교대근무 스케줄러 (2조 2교대 전용)
// Google Apps Script
//
// 사용법:
//   1. Google Sheets 열기
//   2. 확장 프로그램 → Apps Script 붙여넣기
//   3. 저장 후 실행: setupAllSheets()
// ============================================================

// ============================================================
// 전역 설정
// ============================================================
const CONFIG = {
  SHIFT_A: { name: "A조 (주간)", start: "08:00", end: "20:00", color: "#FFE599" }, // 노란색
  SHIFT_B: { name: "B조 (야간)", start: "20:00", end: "08:00", color: "#9FC5E8" }, // 파란색
  OFF_COLOR: "#D9D9D9",       // 비번/휴일 회색
  HOLIDAY_COLOR: "#EA9999",   // 공휴일 빨간색
  HEADER_COLOR: "#434343",
  HEADER_FONT_COLOR: "#FFFFFF",
  ROTATION_WEEKS: 1,          // 몇 주마다 주간/야간 교대하는지 (보통 1주)
};

// ============================================================
// 메뉴 등록 (스프레드시트 열릴 때 자동 실행)
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📋 ShiftMate")
    .addItem("1️⃣  전체 시트 초기 설정", "setupAllSheets")
    .addSeparator()
    .addItem("📅 이번 달 스케줄 생성", "generateThisMonthSchedule")
    .addItem("📅 다음 달 스케줄 생성", "generateNextMonthSchedule")
    .addSeparator()
    .addItem("📊 대시보드 새로고침", "refreshDashboard")
    .addItem("📤 이번 달 출결 현황 출력", "exportAttendanceSummary")
    .addToUi();
}

// ============================================================
// 1단계: 전체 시트 초기 설정
// ============================================================
function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const result = ui.alert(
    "⚠️ 초기 설정",
    "기존 시트가 있으면 모두 초기화됩니다.\n계속하시겠습니까?",
    ui.ButtonSet.YES_NO
  );
  if (result !== ui.Button.YES) return;

  // 기존 시트 삭제 (기본 Sheet1 제외)
  const sheets = ss.getSheets();
  sheets.forEach(s => {
    if (s.getName() !== "임시") {
      try { ss.deleteSheet(s); } catch (e) {}
    }
  });

  // 시트 생성
  setupWorkerSheet(ss);
  setupScheduleSheet(ss);
  setupAttendanceSheet(ss);
  setupDashboard(ss);

  // 임시 시트가 있으면 삭제
  const temp = ss.getSheetByName("임시");
  if (temp) ss.deleteSheet(temp);

  ss.setActiveSheet(ss.getSheetByName("📋 직원목록"));
  ui.alert("✅ 설정 완료", "시트 4개가 생성되었습니다.\n\n📋 직원목록 → 직원 정보 입력\n📅 월별스케줄 → 스케줄 자동 생성\n✅ 출결기록 → 매일 출퇴근 기록\n📊 대시보드 → 현황 요약", ui.ButtonSet.OK);
}

// ============================================================
// 시트 1: 직원목록
// ============================================================
function setupWorkerSheet(ss) {
  let sheet = ss.getSheetByName("📋 직원목록");
  if (!sheet) sheet = ss.insertSheet("📋 직원목록");
  sheet.clear();

  // 헤더
  const headers = ["번호", "이름", "전화번호", "소속 조", "직책", "입사일", "비고", "재직여부"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet.getRange(1, 1, 1, headers.length));

  // 열 너비
  sheet.setColumnWidth(1, 50);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 80);
  sheet.setColumnWidth(6, 100);
  sheet.setColumnWidth(7, 150);
  sheet.setColumnWidth(8, 80);

  // 드롭다운: 조
  const groupRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["A조", "B조"], true).build();
  sheet.getRange("D2:D200").setDataValidation(groupRule);

  // 드롭다운: 직책
  const roleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["작업자", "조장", "관리자"], true).build();
  sheet.getRange("E2:E200").setDataValidation(roleRule);

  // 드롭다운: 재직여부
  const activeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["재직", "퇴직"], true).build();
  sheet.getRange("H2:H200").setDataValidation(activeRule);

  // 번호 자동 채우기 (ARRAYFORMULA)
  sheet.getRange("A2").setFormula('=IFERROR(IF(B2="","",ROW()-1),"")');

  // 예시 데이터
  const sampleData = [
    ["", "홍길동", "010-1234-5678", "A조", "조장", "2022-03-01", "", "재직"],
    ["", "김철수", "010-2345-6789", "A조", "작업자", "2023-01-10", "", "재직"],
    ["", "이영희", "010-3456-7890", "B조", "조장", "2021-07-15", "", "재직"],
    ["", "박민준", "010-4567-8901", "B조", "작업자", "2023-06-01", "", "재직"],
  ];
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);

  // 조 색상 조건부 서식
  applyGroupConditionalFormat(sheet, "D2:D200");

  sheet.setFrozenRows(1);
  return sheet;
}

// ============================================================
// 시트 2: 월별 스케줄
// ============================================================
function setupScheduleSheet(ss) {
  let sheet = ss.getSheetByName("📅 월별스케줄");
  if (!sheet) sheet = ss.insertSheet("📅 월별스케줄");
  sheet.clear();

  // 설명 텍스트
  sheet.getRange("A1").setValue("📅 월별스케줄");
  sheet.getRange("A1").setFontSize(16).setFontWeight("bold");
  sheet.getRange("B1").setValue("← 위 메뉴에서 [ShiftMate → 이번 달 스케줄 생성]을 클릭하세요");
  sheet.getRange("B1").setFontColor("#888888").setFontStyle("italic");

  return sheet;
}

// ============================================================
// 스케줄 자동 생성 (이번 달)
// ============================================================
function generateThisMonthSchedule() {
  const now = new Date();
  generateMonthSchedule(now.getFullYear(), now.getMonth() + 1);
}

function generateNextMonthSchedule() {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 2;
  if (month > 12) { month = 1; year++; }
  generateMonthSchedule(year, month);
}

function generateMonthSchedule(year, month) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const workerSheet = ss.getSheetByName("📋 직원목록");
  const schedSheet = ss.getSheetByName("📅 월별스케줄");

  if (!workerSheet || !schedSheet) {
    SpreadsheetApp.getUi().alert("먼저 '전체 시트 초기 설정'을 실행하세요.");
    return;
  }

  // 직원 데이터 읽기
  const workerData = workerSheet.getDataRange().getValues();
  const workers = [];
  for (let i = 1; i < workerData.length; i++) {
    const row = workerData[i];
    if (!row[1] || row[7] === "퇴직") continue; // 이름 없거나 퇴직자 제외
    workers.push({
      name: row[1],
      group: row[3], // "A조" or "B조"
      role: row[4],
    });
  }

  if (workers.length === 0) {
    SpreadsheetApp.getUi().alert("직원목록 시트에 직원 정보를 먼저 입력하세요.");
    return;
  }

  // 해당 월의 날짜 계산
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1);

  // 주간 교대 계산: A조가 첫 주에 무슨 근무인지 결정
  // (1월 1일 기준 A조=주간으로 고정, 매주 월요일마다 교대)
  const jan1 = new Date(year, 0, 1);
  const weeksSinceJan1 = Math.floor(
    (firstDay - jan1) / (7 * 24 * 60 * 60 * 1000)
  );

  schedSheet.clear();

  // ── 헤더 행 ──
  const monthStr = `${year}년 ${month}월 교대 스케줄`;
  schedSheet.getRange(1, 1).setValue(monthStr)
    .setFontSize(14).setFontWeight("bold");

  // 범례
  schedSheet.getRange(1, 3).setValue("■ 주간 08:00~20:00")
    .setBackground(CONFIG.SHIFT_A.color).setFontWeight("bold");
  schedSheet.getRange(1, 5).setValue("■ 야간 20:00~08:00")
    .setBackground(CONFIG.SHIFT_B.color).setFontWeight("bold");
  schedSheet.getRange(1, 7).setValue("■ 휴일")
    .setBackground(CONFIG.HOLIDAY_COLOR);

  // ── 날짜 헤더 ──
  const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
  const dateRow = [["이름", "조"]];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dayOfWeek = date.getDay();
    dateRow[0].push(`${d}\n(${DAY_KO[dayOfWeek]})`);
  }
  dateRow[0].push("주간합계", "야간합계", "총근무일");

  schedSheet.getRange(2, 1, 1, dateRow[0].length).setValues(dateRow);
  styleHeader(schedSheet.getRange(2, 1, 1, dateRow[0].length));

  // 토/일 열 색상
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dayOfWeek = date.getDay();
    const col = d + 2;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      schedSheet.getRange(2, col).setBackground("#FF9999").setFontColor("#FFFFFF");
    }
  }

  // ── 직원별 스케줄 행 ──
  let rowIdx = 3;
  const groupOrder = { "A조": 0, "B조": 1 };

  // A조 / B조 그룹 헤더
  const groups = ["A조", "B조"];
  groups.forEach(group => {
    const groupWorkers = workers.filter(w => w.group === group);
    if (groupWorkers.length === 0) return;

    // 그룹 헤더 행
    schedSheet.getRange(rowIdx, 1, 1, daysInMonth + 4).merge();
    schedSheet.getRange(rowIdx, 1).setValue(`▶ ${group} (총 ${groupWorkers.length}명)`)
      .setFontWeight("bold").setFontSize(11)
      .setBackground(group === "A조" ? "#FFF2CC" : "#CFE2F3");
    rowIdx++;

    groupWorkers.forEach(worker => {
      const rowData = [worker.name, worker.group];
      let dayShiftCount = 0;
      let nightShiftCount = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dayOfWeek = date.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

        // 주 번호 계산 (월요일 기준)
        const weeksSinceStart = Math.floor(
          (date - jan1) / (7 * 24 * 60 * 60 * 1000)
        );

        // A조 기준 시프트 (짝수주=주간, 홀수주=야간)
        const aGroupIsDay = (weeksSinceStart % 2 === 0);
        const isDay = (group === "A조") ? aGroupIsDay : !aGroupIsDay;

        if (isWeekend) {
          rowData.push("휴");
        } else if (isDay) {
          rowData.push("주");
          dayShiftCount++;
        } else {
          rowData.push("야");
          nightShiftCount++;
        }
      }

      rowData.push(dayShiftCount, nightShiftCount, dayShiftCount + nightShiftCount);
      schedSheet.getRange(rowIdx, 1, 1, rowData.length).setValues([rowData]);

      // 셀 색상 입히기
      for (let d = 1; d <= daysInMonth; d++) {
        const cell = schedSheet.getRange(rowIdx, d + 2);
        const val = rowData[d + 1];
        if (val === "주") cell.setBackground(CONFIG.SHIFT_A.color);
        else if (val === "야") cell.setBackground(CONFIG.SHIFT_B.color);
        else if (val === "휴") cell.setBackground(CONFIG.OFF_COLOR).setFontColor("#888888");
      }

      rowIdx++;
    });
  });

  // ── 열 너비 조정 ──
  schedSheet.setColumnWidth(1, 80);
  schedSheet.setColumnWidth(2, 50);
  for (let d = 1; d <= daysInMonth; d++) {
    schedSheet.setColumnWidth(d + 2, 35);
  }
  schedSheet.setColumnWidth(daysInMonth + 3, 70);
  schedSheet.setColumnWidth(daysInMonth + 4, 70);
  schedSheet.setColumnWidth(daysInMonth + 5, 70);

  schedSheet.setFrozenRows(2);
  schedSheet.setFrozenColumns(2);

  ss.setActiveSheet(schedSheet);
  SpreadsheetApp.getUi().alert(
    "✅ 스케줄 생성 완료",
    `${monthStr} 생성되었습니다.\n\n주간(주) = ${CONFIG.SHIFT_A.start}~${CONFIG.SHIFT_A.end}\n야간(야) = ${CONFIG.SHIFT_B.start}~${CONFIG.SHIFT_B.end}\n\n⚠️ 수동 수정이 필요한 날짜는 직접 편집하세요.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
// 시트 3: 출결기록
// ============================================================
function setupAttendanceSheet(ss) {
  let sheet = ss.getSheetByName("✅ 출결기록");
  if (!sheet) sheet = ss.insertSheet("✅ 출결기록");
  sheet.clear();

  const headers = [
    "날짜", "이름", "조", "근무유형",
    "출근시간", "퇴근시간", "실근무(분)",
    "지각여부", "조기퇴근", "초과근무(분)", "상태", "비고"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet.getRange(1, 1, 1, headers.length));

  // 열 너비
  const widths = [100, 80, 60, 70, 90, 90, 90, 70, 80, 90, 70, 150];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // 드롭다운: 근무유형
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["주간", "야간", "특근", "결근"], true).build();
  sheet.getRange("D2:D1000").setDataValidation(typeRule);

  // 드롭다운: 상태
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["정상", "지각", "조기퇴근", "결근", "특근"], true).build();
  sheet.getRange("K2:K1000").setDataValidation(statusRule);

  // 실근무 자동 계산 (분 단위)
  sheet.getRange("G2").setFormula(
    '=IFERROR(IF(F2="","",IF(D2="야간",MOD(TIMEVALUE(TEXT(F2,"HH:MM"))-TIMEVALUE(TEXT(E2,"HH:MM")),1)*24*60,(TIMEVALUE(TEXT(F2,"HH:MM"))-TIMEVALUE(TEXT(E2,"HH:MM")))*24*60)),"")'
  );

  // 조 색상 조건부 서식
  applyGroupConditionalFormat(sheet, "C2:C1000");

  // 상태별 색상 조건부 서식
  const rules = sheet.getConditionalFormatRules();

  const lateRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("지각")
    .setBackground("#FFE0B2")
    .setRanges([sheet.getRange("K2:K1000")])
    .build();

  const absentRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("결근")
    .setBackground("#FFCDD2")
    .setRanges([sheet.getRange("K2:K1000")])
    .build();

  rules.push(lateRule, absentRule);
  sheet.setConditionalFormatRules(rules);

  sheet.setFrozenRows(1);
  return sheet;
}

// ============================================================
// 시트 4: 대시보드
// ============================================================
function setupDashboard(ss) {
  let sheet = ss.getSheetByName("📊 대시보드");
  if (!sheet) sheet = ss.insertSheet("📊 대시보드");
  sheet.clear();

  sheet.getRange("A1").setValue("📊 ShiftMate 대시보드")
    .setFontSize(18).setFontWeight("bold");
  sheet.getRange("A2").setValue("마지막 업데이트: " + new Date().toLocaleString("ko-KR"))
    .setFontColor("#888888");

  // 이번 달 요약
  sheet.getRange("A4").setValue("📅 이번 달 요약").setFontSize(13).setFontWeight("bold");
  const now = new Date();
  const summaryHeaders = [["항목", "A조", "B조", "전체"]];
  sheet.getRange("A5:D5").setValues(summaryHeaders);
  styleHeader(sheet.getRange("A5:D5"));

  const summaryRows = [
    ["총 근무 인원", "=COUNTIFS('📋 직원목록'!D:D,\"A조\",'📋 직원목록'!H:H,\"재직\")", "=COUNTIFS('📋 직원목록'!D:D,\"B조\",'📋 직원목록'!H:H,\"재직\")", "=B6+C6"],
    ["이번 달 출근 횟수", `=COUNTIFS('✅ 출결기록'!C:C,"A조",'✅ 출결기록'!K:K,"<>결근")`, `=COUNTIFS('✅ 출결기록'!C:C,"B조",'✅ 출결기록'!K:K,"<>결근")`, "=B7+C7"],
    ["이번 달 결근 횟수", `=COUNTIFS('✅ 출결기록'!C:C,"A조",'✅ 출결기록'!K:K,"결근")`, `=COUNTIFS('✅ 출결기록'!C:C,"B조",'✅ 출결기록'!K:K,"결근")`, "=B8+C8"],
    ["이번 달 지각 횟수", `=COUNTIFS('✅ 출결기록'!C:C,"A조",'✅ 출결기록'!K:K,"지각")`, `=COUNTIFS('✅ 출결기록'!C:C,"B조",'✅ 출결기록'!K:K,"지각")`, "=B9+C9"],
  ];
  sheet.getRange("A6:D9").setValues(summaryRows);

  // 테두리
  sheet.getRange("A5:D9").setBorder(true, true, true, true, true, true);

  // 최근 출결 10건
  sheet.getRange("A12").setValue("📋 최근 출결 10건").setFontSize(13).setFontWeight("bold");
  sheet.getRange("A13:F13").setValues([["날짜", "이름", "조", "근무유형", "출근", "상태"]]);
  styleHeader(sheet.getRange("A13:F13"));

  for (let i = 0; i < 10; i++) {
    const row = 14 + i;
    sheet.getRange(`A${row}`).setFormula(`=IFERROR(INDEX('✅ 출결기록'!A:A,LARGE(IF('✅ 출결기록'!A:A<>"",ROW('✅ 출결기록'!A:A),""),${i + 1})),"")`);
    sheet.getRange(`B${row}`).setFormula(`=IFERROR(INDEX('✅ 출결기록'!B:B,LARGE(IF('✅ 출결기록'!A:A<>"",ROW('✅ 출결기록'!A:A),""),${i + 1})),"")`);
    sheet.getRange(`C${row}`).setFormula(`=IFERROR(INDEX('✅ 출결기록'!C:C,LARGE(IF('✅ 출결기록'!A:A<>"",ROW('✅ 출결기록'!A:A),""),${i + 1})),"")`);
    sheet.getRange(`D${row}`).setFormula(`=IFERROR(INDEX('✅ 출결기록'!D:D,LARGE(IF('✅ 출결기록'!A:A<>"",ROW('✅ 출결기록'!A:A),""),${i + 1})),"")`);
    sheet.getRange(`E${row}`).setFormula(`=IFERROR(INDEX('✅ 출결기록'!E:E,LARGE(IF('✅ 출결기록'!A:A<>"",ROW('✅ 출결기록'!A:A),""),${i + 1})),"")`);
    sheet.getRange(`F${row}`).setFormula(`=IFERROR(INDEX('✅ 출결기록'!K:K,LARGE(IF('✅ 출결기록'!A:A<>"",ROW('✅ 출결기록'!A:A),""),${i + 1})),"")`);
  }

  // 열 너비
  [120, 80, 60, 70, 90, 70].forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  return sheet;
}

// ============================================================
// 대시보드 새로고침
// ============================================================
function refreshDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("📊 대시보드");
  if (!sheet) return;
  sheet.getRange("A2").setValue("마지막 업데이트: " + new Date().toLocaleString("ko-KR"));
  SpreadsheetApp.getUi().alert("✅ 대시보드가 새로고침되었습니다.");
}

// ============================================================
// 이번 달 출결 현황 내보내기 (새 시트에 요약)
// ============================================================
function exportAttendanceSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attSheet = ss.getSheetByName("✅ 출결기록");
  if (!attSheet) return;

  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const exportName = `📤 ${now.getFullYear()}년${now.getMonth() + 1}월_출결요약`;

  let exportSheet = ss.getSheetByName(exportName);
  if (exportSheet) ss.deleteSheet(exportSheet);
  exportSheet = ss.insertSheet(exportName);

  const attData = attSheet.getDataRange().getValues();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 이번 달 데이터만 필터링
  const thisMonthData = attData.filter((row, idx) => {
    if (idx === 0) return false;
    if (!row[0]) return false;
    const dateStr = row[0] instanceof Date
      ? `${row[0].getFullYear()}-${String(row[0].getMonth() + 1).padStart(2, "0")}`
      : String(row[0]).substring(0, 7);
    return dateStr === monthStr;
  });

  // 직원별 집계
  const summary = {};
  thisMonthData.forEach(row => {
    const name = row[1];
    const group = row[2];
    const type = row[3];
    const status = row[10];
    if (!name) return;
    if (!summary[name]) {
      summary[name] = { name, group, day: 0, night: 0, absent: 0, late: 0, overtime: 0 };
    }
    if (type === "주간") summary[name].day++;
    else if (type === "야간") summary[name].night++;
    if (status === "결근") summary[name].absent++;
    if (status === "지각") summary[name].late++;
    summary[name].overtime += Number(row[9]) || 0;
  });

  const headers = [["이름", "조", "주간근무", "야간근무", "총근무", "결근", "지각", "초과근무(분)"]];
  exportSheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
  styleHeader(exportSheet.getRange(1, 1, 1, headers[0].length));

  const rows = Object.values(summary).map(s => [
    s.name, s.group, s.day, s.night, s.day + s.night, s.absent, s.late, s.overtime
  ]);

  if (rows.length > 0) {
    exportSheet.getRange(2, 1, rows.length, headers[0].length).setValues(rows);
  }

  ss.setActiveSheet(exportSheet);
  SpreadsheetApp.getUi().alert(`✅ ${now.getMonth() + 1}월 출결 요약이 "${exportName}" 시트에 생성되었습니다.`);
}

// ============================================================
// 유틸리티 함수
// ============================================================
function styleHeader(range) {
  range
    .setBackground(CONFIG.HEADER_COLOR)
    .setFontColor(CONFIG.HEADER_FONT_COLOR)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
}

function applyGroupConditionalFormat(sheet, rangeA1) {
  const rules = sheet.getConditionalFormatRules();

  const aRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("A조")
    .setBackground(CONFIG.SHIFT_A.color)
    .setRanges([sheet.getRange(rangeA1)])
    .build();

  const bRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("B조")
    .setBackground(CONFIG.SHIFT_B.color)
    .setRanges([sheet.getRange(rangeA1)])
    .build();

  rules.push(aRule, bRule);
  sheet.setConditionalFormatRules(rules);
}
