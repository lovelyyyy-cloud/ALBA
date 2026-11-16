export type PayType = 'daily' | 'hourly' | 'piece';

export type ShiftInputMode = 'min_wage' | 'custom_hourly' | 'daily_incentive';

export type TaxType = 'daily_tax' | 'freelance_3_3' | 'four_insurance' | 'none' | 'custom';

export type PayCycle = 'same_day' | 'weekly' | 'monthly';

export type JobColorKey = 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan';

export type PaymentStatus = 'settled' | 'pending';

export type JobMajorCategory = '주간' | '야간' | '주말(주간)' | '주말(야간)';

export type EmploymentType = '정규직' | '계약직';

export interface JobProfile {
  id: string;
  name: string; // 소분류: 직장명
  majorCategory: JobMajorCategory; // 대분류: 주간, 야간, 주말(주간), 주말(야간)
  subCategory: string; // 소분류: 분류 (물류센터, 식당 등)
  address?: string; // 소분류: 주소 (선택항목)
  groupName: string; // 호환/커스텀 그룹명
  roleLabel: string;
  color: JobColorKey;
  payType: PayType;
  defaultInputMode?: ShiftInputMode;
  defaultRate: number;
  defaultStartTime: string;
  defaultEndTime: string;
  defaultBreakMinutes: number;
  taxType: TaxType;
  customTaxRate?: number;
  payCycle: PayCycle;
  payDayNote?: string;
  enableNightAllowance: boolean;
  enableOvertimeAllowance: boolean;
  includeWeeklyHolidayPay: boolean;
  archived?: boolean;
}

export interface WorkShift {
  id: string;
  date: string;
  jobId: string;
  inputMode?: ShiftInputMode;
  hourlyRateOverride?: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workUnits: number;
  manualBasePay?: number;
  extraAllowance: number;
  expenseDeduction: number;
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
  monthKey: string;
  totalShifts: number;
  uniqueWorkedDays: number;
  multiJobDays: number;
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

export interface SalarySimulation {
  id: string;
  companyName: string;
  employmentType: EmploymentType;
  contractMonths: number; // 계약직 개월수 (예: 6, 12)
  annualSalary: number; // 세전 연봉(원)
  severanceIncluded: boolean; // 퇴직금 포함 여부
  nonTaxableMonthly: number; // 월 비과세 식대 등 (기본 200,000원)
  dependents: number; // 본인 포함 부양가족 수
  childrenCount: number; // 8~20세 자녀 수
  createdAt: string;
}

export interface SalaryBreakdown {
  monthlyGross: number;
  monthlyTaxable: number;
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  totalMonthlyDeduction: number;
  monthlyNet: number;
  annualNet: number;
  contractTotalGross: number;
  contractTotalNet: number;
  estimatedSeverance: number;
}

export type AccountEntryType = 'expense' | 'fixed' | 'saving' | 'income';

export type PaymentMethod = '카드' | '현금·체크' | '계좌이체';

export interface AccountBookEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: AccountEntryType; // 지출(변동), 고정비, 저축·투자, 기타수입
  category: string; // 식비, 월세·관리비, 교통·주유비, 적금 등
  title: string; // 내용
  amount: number;
  paymentMethod: PaymentMethod;
  memo?: string;
  createdAt: string;
}

export interface AppSettings {
  monthlyGoalNetPay: number;
  monthlyBudgetLimit?: number;
  weekStartsOnMonday: boolean;
}
