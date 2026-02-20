-- ============================================================
-- ShiftMate MVP 스키마 (2조 2교대 최적화)
-- Supabase에서 직접 실행하세요 (SQL Editor)
-- ============================================================

-- 직원 테이블
CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(15),
    pin_hash VARCHAR(4) NOT NULL,      -- MVP: 평문 4자리 (추후 bcrypt로 교체)
    group_name VARCHAR(10) NOT NULL CHECK (group_name IN ('A조', 'B조')),
    role VARCHAR(20) NOT NULL DEFAULT 'worker'
        CHECK (role IN ('worker', 'line_leader', 'manager', 'admin')),
    hire_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 근무 일정 테이블
CREATE TABLE shift_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    shift_type VARCHAR(10) NOT NULL CHECK (shift_type IN ('주간', '야간', '휴일', '특근')),
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'confirmed', 'absent', 'emergency')),
    is_manually_modified BOOLEAN DEFAULT false,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(worker_id, schedule_date)
);

-- 출결 기록 테이블
CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES shift_schedules(id),
    check_in_at TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT '정상'
        CHECK (status IN ('정상', '지각', '조기퇴근', '결근', '특근')),
    late_minutes INT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_workers_active ON workers(is_active, group_name);
CREATE INDEX idx_schedules_date ON shift_schedules(worker_id, schedule_date);
CREATE INDEX idx_attendances_worker_date ON attendances(worker_id, check_in_at);

-- ============================================================
-- 샘플 데이터 (테스트용 - 실사용 시 삭제)
-- ============================================================
INSERT INTO workers (name, phone, pin_hash, group_name, role) VALUES
    ('홍길동', '010-1234-5678', '1234', 'A조', 'line_leader'),
    ('김철수', '010-2345-6789', '2345', 'A조', 'worker'),
    ('이영희', '010-3456-7890', '3456', 'B조', 'line_leader'),
    ('박민준', '010-4567-8901', '4567', 'B조', 'worker');
