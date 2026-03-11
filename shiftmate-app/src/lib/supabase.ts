import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 데이터베이스 타입 정의
export type Worker = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  pin_hash: string;
  group_name: "A조" | "B조";
  role: "worker" | "line_leader" | "manager" | "admin";
  hire_date: string | null;
  is_active: boolean;
  created_at: string;
};

export type ShiftSchedule = {
  id: string;
  tenant_id: string;
  worker_id: string;
  schedule_date: string;
  shift_type: "주간" | "야간" | "휴일" | "특근";
  status: "scheduled" | "confirmed" | "absent" | "emergency";
  worker?: Worker;
};

export type Attendance = {
  id: string;
  tenant_id: string;
  worker_id: string;
  schedule_id: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  status: "정상" | "지각" | "조기퇴근" | "결근" | "특근";
  late_minutes: number;
  overtime_minutes: number;
  note: string | null;
  worker?: Worker;
};
