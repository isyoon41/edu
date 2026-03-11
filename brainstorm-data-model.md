# 🧠 Super Brainstorming: 교대근무 스케줄러 데이터 모델 설계

## 라운드 1

### 🎯 기획자 제안

#### 핵심 비전: "어떤 교대 패턴이든 표현할 수 있는 유연한 데이터 모델"

MVP 지원 상위 5개 교대 패턴:

| 패턴 | 구조 | 설명 |
|------|------|------|
| 3조 2교대 | 주간-야간-비번 순환 | 가장 흔한 제조업 패턴 |
| 4조 3교대 | 주간-야간-저녁-비번 순환 | 24시간 가동 공장 |
| 2조 2교대 (주야맞교대) | 주간-야간 반복 (비번 없음) | 소규모 공장 |
| 주간 고정 + 야간 고정 | 교대 없이 고정 시간 근무 | 반교대 사업장 |
| 4조 2교대 | 주간2일-야간2일-비번2일 | 주 40시간 맞춤형 |

초기 설계: 10개 테이블 (companies, factories, production_lines, workers, shift_patterns, shift_slots, shift_groups, group_members, shift_schedules, attendances)

### 👊 비판자 리뷰

1. **순환 매핑(rotation matrix) 부재** - "N일차에 M조는 어떤 슬롯인가" 정의가 없음. 스케줄 자동 생성 불가능.
2. **UNIQUE(worker_id, schedule_date) 위험** - 하루에 2개 시프트(반차+특근 등) 불가.
3. **급여 계산 필드 부족** - 야간/연장/휴일 근무 분을 별도 저장하는 구조 필요.
4. **공휴일 처리 없음** - holidays 테이블 필요.
5. **PIN 평문 저장** - 해시 저장 필수.

---

## 라운드 2

### 🎯 기획자 제안 (개선안)

핵심 추가:
1. **`pattern_rotations` 테이블** - "day_index × group_order → slot_id" 순환 행렬
2. **`work_hour_details` 테이블** - 근무유형별(정규/연장/야간/휴일) 시간과 배율 저장
3. **`holidays` 테이블** - 법정공휴일 + 회사 자체 휴일
4. **UNIQUE 제약 수정** - `(worker_id, schedule_date, slot_id)`로 복수 근무 허용
5. **PIN 해시 저장** - bcrypt 해시 (VARCHAR(60))

### 👊 비판자 리뷰

1. **변칙 교대(월 단위 순환)** - cycle_days=28 같은 긴 주기 패턴의 MVP 지원 범위 결정 필요.
2. **work_hour_details 계산 시점** - 실시간 vs 배치 결정이 데이터 모델에 영향.
3. **조 이동(전조) 처리** - 이동 시 미래 스케줄 재생성 필요. 이력 관리 구조 필요.
4. **소프트 삭제 정책** - 퇴사자 데이터 법적 보존 의무(3년) 처리 필요.

---

## 라운드 3

### 🎯 기획자 제안 (핵심 기능 상세화)

결정 사항:
1. **MVP 최대 순환 주기 = 7일** - 월 단위 변칙 교대는 MVP 제외
2. **work_hour_details 하이브리드** - 체크아웃 시 즉시 계산 + 월말 배치 정산
3. **`group_transfers` 테이블 추가** - 조 이동 이력 관리, effective_date 기준 미래 스케줄 재생성
4. **데이터 보존 정책** - terminated_at + 3년 후 자동 익명화

전체 14개 테이블 정의 완료.

### 👊 비판자 리뷰

1. **shift_schedules 쿼리 최적화** - `(factory_id, schedule_date)` 복합 인덱스 필수.
2. **수동 수정 스케줄 보호** - 자동 재생성 시 수동 수정분 덮어쓰기 방지 메커니즘 필요.
3. **스케줄 없는 긴급 출근** - attendances.schedule_id nullable 필요.
4. **인덱스 전략 명시 필요** - 핵심 쿼리 4개에 대한 인덱스 설계.

---

## 라운드 4

### 🎯 기획자 제안 (비즈니스 모델 구체화)

해결:
1. **`is_manually_modified` 플래그** - 자동 생성 시 수동 수정 행 보호
2. **긴급 출근** - `status='emergency'` + `schedule_id` nullable
3. **인덱스 4개** - factory_date, worker_date, factory_checkin, worker_checkin
4. **스케줄 생성 프로세스** - 자동 생성 → 미리보기 → 관리자 확인 2단계

### 👊 비판자 리뷰

1. **is_manually_modified 누적** - 오래된 수동 수정 자동 해제 정책 필요.
2. **엑셀 데이터 이관** - CSV 임포트 온보딩 필요.
3. **멀티테넌시** - Row-Level Security(RLS) 적용 계획 필요.
4. **테이블 14개는 MVP에 과다** - 단일 공장 지원 시 companies/factories/production_lines 불필요.

---

## 라운드 5

### 🎯 기획자 제안 (MVP 정의 & 실행 계획)

14개 → 9개 테이블로 축소 (단일 테넌트 우선):

| # | 테이블 | 우선순위 |
|---|--------|----------|
| 1 | workers | P0 |
| 2 | shift_patterns | P0 |
| 3 | shift_slots | P0 |
| 4 | pattern_rotations | P0 |
| 5 | shift_groups | P0 |
| 6 | group_members | P0 |
| 7 | shift_schedules | P0 |
| 8 | attendances | P0 |
| 9 | holidays | P0 |
| - | work_hour_details | P1 |
| - | group_transfers | P2 |

멀티테넌시: tenant_id + PostgreSQL RLS
온보딩: 작업자 CSV 임포트 + 패턴 템플릿 선택

### 👊 비판자 리뷰

1. tenant_id 기반 확장 가능 구조 적절 ✅
2. 엣지케이스 정리 필요:
   - 누락 체크아웃 → 익일 자동 알림 + 관리자 수동 처리
   - 중복 체크인 → 기존 미완료 세션 있으면 차단
   - 자정 넘김 근무 → schedule_date는 시작일 기준으로 통일

---

## 최종 결정

### 🏆 Product Owner 평가

**결정: GO (조건 없음)**

| 평가 항목 | 점수 | 코멘트 |
|-----------|------|--------|
| 데이터 정합성 | ⭐⭐⭐⭐⭐ | rotation matrix, 수동 수정 보호, 조 이동 이력 모두 고려 |
| MVP 적합성 | ⭐⭐⭐⭐⭐ | 14개 → 9개 축소. 확장 가능한 구조 |
| 확장 가능성 | ⭐⭐⭐⭐ | tenant_id 기반 멀티 공장, 급여 계산 점진적 확장 |
| 보안/법적 준수 | ⭐⭐⭐⭐ | PIN 해시, RLS, 3년 보존 후 익명화 |
| 실현 가능성 | ⭐⭐⭐⭐⭐ | 표준 PostgreSQL, 특별한 기술 불필요 |

### 최종 MVP 데이터 모델

```
9개 테이블 | PostgreSQL + RLS
핵심: pattern_rotations (순환행렬) 기반 자동 스케줄 생성
보호: is_manually_modified 플래그
체크인: PIN 해시 + 사진 URL
인덱스: 4개 핵심 복합 인덱스
보존: 3년 후 자동 익명화
온보딩: CSV 임포트 + 패턴 템플릿
```

### 최종 SQL 스키마

```sql
-- ============================================
-- ShiftMate MVP 데이터 모델
-- PostgreSQL 14+
-- ============================================

-- 작업자
CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(15),
    pin_hash VARCHAR(60) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'worker'
        CHECK (role IN ('worker', 'line_leader', 'manager', 'admin')),
    hire_date DATE,
    is_active BOOLEAN DEFAULT true,
    terminated_at DATE,
    data_retention_until DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 교대 패턴
CREATE TABLE shift_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    pattern_type VARCHAR(20) NOT NULL DEFAULT 'rotating'
        CHECK (pattern_type IN ('rotating', 'fixed')),
    cycle_days INT NOT NULL CHECK (cycle_days BETWEEN 1 AND 7),
    shifts_per_day INT NOT NULL,
    num_groups INT NOT NULL,
    cycle_start_date DATE NOT NULL,
    is_template BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 근무 시간대 (주간/야간/비번 등)
CREATE TABLE shift_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID NOT NULL REFERENCES shift_patterns(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    slot_type VARCHAR(20) NOT NULL
        CHECK (slot_type IN ('day', 'night', 'evening', 'off')),
    start_time TIME,
    end_time TIME,
    is_overnight BOOLEAN DEFAULT false,
    break_minutes INT DEFAULT 60,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 순환 행렬 (핵심!)
CREATE TABLE pattern_rotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID NOT NULL REFERENCES shift_patterns(id) ON DELETE CASCADE,
    day_index INT NOT NULL,
    group_order INT NOT NULL,
    slot_id UUID NOT NULL REFERENCES shift_slots(id),
    UNIQUE(pattern_id, day_index, group_order)
);

-- 조/팀
CREATE TABLE shift_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    pattern_id UUID NOT NULL REFERENCES shift_patterns(id),
    name VARCHAR(50) NOT NULL,
    group_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 작업자-조 매핑
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES shift_groups(id),
    worker_id UUID NOT NULL REFERENCES workers(id),
    joined_at DATE NOT NULL,
    left_at DATE,
    UNIQUE(group_id, worker_id, joined_at)
);

-- 근무 일정
CREATE TABLE shift_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    worker_id UUID NOT NULL REFERENCES workers(id),
    group_id UUID REFERENCES shift_groups(id),
    slot_id UUID REFERENCES shift_slots(id),
    schedule_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'confirmed', 'absent', 'substituted', 'emergency')),
    substitute_worker_id UUID REFERENCES workers(id),
    is_manually_modified BOOLEAN DEFAULT false,
    modified_by UUID REFERENCES workers(id),
    modified_at TIMESTAMP,
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(worker_id, schedule_date, slot_id)
);

-- 출결 기록
CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    worker_id UUID NOT NULL REFERENCES workers(id),
    schedule_id UUID REFERENCES shift_schedules(id),
    check_in_at TIMESTAMP,
    check_out_at TIMESTAMP,
    check_in_photo_url TEXT,
    check_out_photo_url TEXT,
    check_in_method VARCHAR(20) DEFAULT 'pin_photo'
        CHECK (check_in_method IN ('pin_photo', 'qr', 'nfc', 'manual')),
    late_minutes INT DEFAULT 0,
    early_leave_minutes INT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 공휴일
CREATE TABLE holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    holiday_date DATE NOT NULL,
    name VARCHAR(100),
    is_paid BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX idx_workers_tenant ON workers(tenant_id);
CREATE INDEX idx_schedules_tenant_date ON shift_schedules(tenant_id, schedule_date);
CREATE INDEX idx_schedules_worker_date ON shift_schedules(worker_id, schedule_date);
CREATE INDEX idx_attendances_tenant_checkin ON attendances(tenant_id, check_in_at);
CREATE INDEX idx_attendances_worker_checkin ON attendances(worker_id, check_in_at);
CREATE INDEX idx_holidays_date ON holidays(tenant_id, holiday_date);

-- ============================================
-- Row-Level Security
-- ============================================
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_workers ON workers
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
CREATE POLICY tenant_isolation_patterns ON shift_patterns
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
CREATE POLICY tenant_isolation_groups ON shift_groups
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
CREATE POLICY tenant_isolation_schedules ON shift_schedules
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
CREATE POLICY tenant_isolation_attendances ON attendances
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
CREATE POLICY tenant_isolation_holidays ON holidays
    USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant')::UUID);
```

### 다음 단계

1. `schema.sql` 파일 생성 → 위 SQL 스키마 확정
2. `seed.sql` 파일 생성 → 5개 교대 패턴 템플릿 시드 데이터
3. 주요 쿼리 작성 → 스케줄 자동 생성, 일별 조회, 월별 집계
