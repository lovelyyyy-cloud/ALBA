export type PayType = 'daily' | 'hourly' | 'piece';

export type ShiftInputMode = 'min_wage' | 'custom_hourly' | 'daily_incentive';

export type TaxType = 'daily_tax' | 'freelance_3_3' | 'four_insurance' | 'none' | 'custom';

export type PayCycle = 'same_day' | 'weekly' | 'monthly';

export type JobColorKey = 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan';

export type PaymentStatus = 'settled' | 'pending';

export interface JobProfile {
  id: string;
  name: string;
  groupName: string; // 그룹별 분류 (예: 현장·물류, 배달·투잡, 매장·알바)
  roleLabel: string;
  color: JobColorKey;
  payType: PayType;
  defaultInputMode?: ShiftInputMode;
  defaultRate: number; // 일급(원), 시급(원), 또는 기본 건당 예상액(원)
  defaultStartTime: string; // "09:00"
  defaultEndTime: string; // "18:00"
  defaultBreakMinutes: number; // 60
  taxType: TaxType;
  customTaxRate?: number; // % (예: 9.4)
  payCycle: PayCycle;
  payDayNote?: string; // 예: "당일 퇴근 후 입금", "매월 10일"
  enableNightAllowance: boolean; // 22:00~06:00 +0.5배
  enableOvertimeAllowance: boolean; // 8시간 초과 +0.5배
  includeWeeklyHolidayPay: boolean; // 주 15시간 이상 주휴수당 계산
  archived?: boolean;
}

export interface WorkShift {
  id: string;
  date: string; // YYYY-MM-DD
  jobId: string;
  inputMode?: ShiftInputMode;
  hourlyRateOverride?: number; // 임의 시급 입력용
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  breakMinutes: number;
  workUnits: number; // 일급제 공수 (0.5, 1, 1.5, 2 등)
  manualBasePay?: number; // 일당 직접 입력 또는 건당 수입
  extraAllowance: number; // 인센티브, 식대, 교통비
  expenseDeduction: number; // 유류비, 수수료, 식비 지출
  paymentStatus: PaymentStatus;
  memo: string;
  createdAt: string;
}

export interface ShiftCalculation {
  inputMode: ShiftInputMode;
  appliedHourlyRate: number;
  workedHours: number;
  nightHours: number;
  overtimeHours: number;
  basePay: number;
  nightPay: number;
  overtimePay: number;
  extraAllowance: number;
  grossPay: number;
  taxAmount: number;
  expenseDeduction: number;
  totalDeduction: number;
  netPay: number;
}

export interface WeeklyHolidayBreakdown {
  weekKey: string;
  weekLabel: string;
  jobId: string;
  jobName: string;
  totalHours: number;
  effectiveHourlyRate: number;
  eligible: boolean;
  holidayPay: number;
}

export interface JobMonthlySummary {
  job: JobProfile;
  shiftCount: number;
  workedDays: number;
  totalHours: number;
  totalWorkUnits: number;
  grossPay: number;
  taxAmount: number;
  expenseDeduction: number;
  totalDeduction: number;
  weeklyHolidayPay: number;
  netPay: number;
  settledNetPay: number;
  pendingNetPay: number;
}

export interface GroupMonthlySummary {
  groupName: string;
  jobCount: number;
  shiftCount: number;
  totalWorkUnits: number;
  totalHours: number;
  grossPay: number;
  taxAmount: number;
  expenseDeduction: number;
  totalDeduction: number;
  weeklyHolidayPay: number;
  netPay: number;
  settledNetPay: number;
  pendingNetPay: number;
}

export interface MonthlySummary {
  monthKey: string; // YYYY-MM
  totalShifts: number;
  uniqueWorkedDays: number;
  multiJobDays: number; // 하루에 2개 이상 근무한 투잡 일수
  totalHours: number;
  totalWorkUnits: number;
  grossPay: number;
  totalTax: number;
  totalExpenses: number;
  totalDeduction: number;
  totalWeeklyHolidayPay: number;
  netPay: number;
  settledNetPay: number;
  pendingNetPay: number;
  avgDailyNetPay: number;
  avgDailyHours: number;
  avgHourlyNetPay: number;
  jobSummaries: JobMonthlySummary[];
  groupSummaries: GroupMonthlySummary[];
  weeklyHolidayBreakdowns: WeeklyHolidayBreakdown[];
}

export interface AppSettings {
  monthlyGoalNetPay: number;
  weekStartsOnMonday: boolean;
}
