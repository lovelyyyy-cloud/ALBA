import {
  EmploymentType,
  GroupMonthlySummary,
  JobColorKey,
  JobMajorCategory,
  JobMonthlySummary,
  JobProfile,
  MonthlySummary,
  PayCycle,
  PayType,
  SalaryBreakdown,
  ShiftCalculation,
  ShiftInputMode,
  TaxType,
  WeeklyHolidayBreakdown,
  WorkShift,
} from '../types/work';

export const MAJOR_CATEGORIES: JobMajorCategory[] = [
  '주간',
  '야간',
  '주말(주간)',
  '주말(야간)',
];

export const SUB_CATEGORY_PRESETS: string[] = [
  '물류센터',
  '식당',
  '카페·베이커리',
  '배달·라이더',
  '건설·현장',
  '편의점·마트',
  '사무·보조',
  '기타',
];

// 대한민국 연도별 법정 최저시급 (원)
export const MINIMUM_WAGE_BY_YEAR: Record<number, number> = {
  2023: 9620,
  2024: 9860,
  2025: 10030,
  2026: 10320,
  2027: 10320,
};

export function getMinimumWageForDate(dateStr: string): { year: number; wage: number } {
  const year = Number(dateStr.slice(0, 4)) || new Date().getFullYear();
  if (MINIMUM_WAGE_BY_YEAR[year]) {
    return { year, wage: MINIMUM_WAGE_BY_YEAR[year] };
  }
  const latestYear = Math.max(...Object.keys(MINIMUM_WAGE_BY_YEAR).map(Number));
  return { year, wage: MINIMUM_WAGE_BY_YEAR[latestYear] };
}

export const SHIFT_INPUT_MODE_LABELS: Record<ShiftInputMode, string> = {
  min_wage: '당해연도 최저시급 자동계산',
  custom_hourly: '임의 시급 입력 자동계산',
  daily_incentive: '일당 + 인센티브 입력',
};

export const JOB_COLOR_STYLES: Record<
  JobColorKey,
  {
    label: string;
    swatch: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    barFill: string;
  }
> = {
  blue: {
    label: '네이비 블루',
    swatch: 'bg-blue-600',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-900',
    badgeBorder: 'border-blue-200',
    barFill: 'bg-blue-600',
  },
  emerald: {
    label: '에메랄드',
    swatch: 'bg-emerald-600',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-200',
    barFill: 'bg-emerald-600',
  },
  amber: {
    label: '앰버',
    swatch: 'bg-amber-600',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-900',
    badgeBorder: 'border-amber-200',
    barFill: 'bg-amber-500',
  },
  violet: {
    label: '바이올렛',
    swatch: 'bg-violet-600',
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-900',
    badgeBorder: 'border-violet-200',
    barFill: 'bg-violet-600',
  },
  rose: {
    label: '로즈',
    swatch: 'bg-rose-600',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-900',
    badgeBorder: 'border-rose-200',
    barFill: 'bg-rose-600',
  },
  cyan: {
    label: '시안',
    swatch: 'bg-cyan-600',
    badgeBg: 'bg-cyan-50',
    badgeText: 'text-cyan-900',
    badgeBorder: 'border-cyan-200',
    barFill: 'bg-cyan-600',
  },
};

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  daily: '일급제 (일당)',
  hourly: '시급제',
  piece: '건당 · 변동수입',
};

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  daily_tax: '일용근로소득세 (15만원 초과 공제)',
  freelance_3_3: '3.3% 사업소득세',
  four_insurance: '4대보험 근로자 공제 (9.4%)',
  custom: '직접 비율 입력 (%)',
  none: '세금 없음 (비과세)',
};

export const PAY_CYCLE_LABELS: Record<PayCycle, string> = {
  same_day: '당일 정산',
  weekly: '주급 정산',
  monthly: '월급 정산',
};

export function formatKRW(amount: number): string {
  const rounded = Math.round(amount);
  return `${rounded.toLocaleString('ko-KR')}원`;
}

export function formatSignedKRW(amount: number): string {
  const rounded = Math.round(amount);
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${rounded.toLocaleString('ko-KR')}원`;
}

export function formatCompactKRW(amount: number): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  if (abs >= 10000) {
    const man = rounded / 10000;
    const formatted = Number.isInteger(man) ? man.toFixed(0) : man.toFixed(1);
    return `${formatted}만`;
  }
  return `${rounded.toLocaleString('ko-KR')}`;
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}시간` : `${rounded.toFixed(1)}시간`;
}

export function parseTimeToMinutes(time: string): number {
  const [hStr, mStr] = time.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function calculateTimeBreakdown(
  startTime: string,
  endTime: string,
  breakMinutes: number
): { workedHours: number; nightHours: number; overtimeHours: number } {
  const start = parseTimeToMinutes(startTime);
  let end = parseTimeToMinutes(endTime);
  if (end <= start) {
    end += 1440;
  }
  const totalSpan = Math.max(0, end - start);
  const safeBreak = Math.min(totalSpan, Math.max(0, breakMinutes || 0));
  const workedMinutes = totalSpan - safeBreak;

  const nightSpan =
    overlapMinutes(start, end, 0, 360) +
    overlapMinutes(start, end, 1320, 1800) +
    overlapMinutes(start, end, 2760, 2880);
  const daySpan = totalSpan - nightSpan;
  const breakInNight = Math.max(0, safeBreak - daySpan);
  const effectiveNightMinutes = Math.max(0, nightSpan - breakInNight);

  const workedHours = Math.round((workedMinutes / 60) * 100) / 100;
  const nightHours = Math.round((effectiveNightMinutes / 60) * 100) / 100;
  const overtimeHours = Math.round(Math.max(0, workedHours - 8) * 100) / 100;

  return { workedHours, nightHours, overtimeHours };
}

export function calculateTaxAmount(
  grossPay: number,
  taxType: TaxType,
  customTaxRate?: number
): number {
  if (grossPay <= 0) return 0;
  switch (taxType) {
    case 'none':
      return 0;
    case 'freelance_3_3': {
      const incomeTax = Math.floor(grossPay * 0.03);
      const localTax = Math.floor(grossPay * 0.003);
      return incomeTax + localTax;
    }
    case 'daily_tax': {
      const taxable = Math.max(0, grossPay - 150000);
      if (taxable <= 0) return 0;
      const incomeTax = Math.floor(taxable * 0.06 * 0.45);
      if (incomeTax < 1000) return 0;
      const localTax = Math.floor(incomeTax * 0.1);
      return incomeTax + localTax;
    }
    case 'four_insurance': {
      const rate = (customTaxRate ?? 9.4) / 100;
      return Math.round(grossPay * rate);
    }
    case 'custom': {
      const rate = Math.max(0, customTaxRate ?? 0) / 100;
      return Math.round(grossPay * rate);
    }
    default:
      return 0;
  }
}

export function resolveShiftInputMode(shift: WorkShift, job?: JobProfile): ShiftInputMode {
  if (shift.inputMode) return shift.inputMode;
  if (job?.defaultInputMode) return job.defaultInputMode;
  if (job?.payType === 'hourly') return 'custom_hourly';
  return 'daily_incentive';
}

export function calculateShift(shift: WorkShift, job?: JobProfile): ShiftCalculation {
  const { workedHours, nightHours, overtimeHours } = calculateTimeBreakdown(
    shift.startTime,
    shift.endTime,
    shift.breakMinutes
  );

  const inputMode = resolveShiftInputMode(shift, job);

  let basePay = 0;
  let nightPay = 0;
  let overtimePay = 0;
  let appliedHourlyRate = 0;

  if (inputMode === 'min_wage') {
    appliedHourlyRate = getMinimumWageForDate(shift.date).wage;
    basePay = Math.round(workedHours * appliedHourlyRate);
    if (job?.enableNightAllowance && nightHours > 0) {
      nightPay = Math.round(nightHours * appliedHourlyRate * 0.5);
    }
    if (job?.enableOvertimeAllowance && overtimeHours > 0) {
      overtimePay = Math.round(overtimeHours * appliedHourlyRate * 0.5);
    }
  } else if (inputMode === 'custom_hourly') {
    appliedHourlyRate =
      shift.hourlyRateOverride !== undefined && shift.hourlyRateOverride >= 0
        ? shift.hourlyRateOverride
        : job?.payType === 'hourly'
          ? job.defaultRate
          : getMinimumWageForDate(shift.date).wage;
    basePay = Math.round(workedHours * appliedHourlyRate);
    if (job?.enableNightAllowance && nightHours > 0) {
      nightPay = Math.round(nightHours * appliedHourlyRate * 0.5);
    }
    if (job?.enableOvertimeAllowance && overtimeHours > 0) {
      overtimePay = Math.round(overtimeHours * appliedHourlyRate * 0.5);
    }
  } else {
    if (shift.manualBasePay !== undefined && shift.manualBasePay !== null && shift.manualBasePay >= 0) {
      const units = shift.workUnits > 0 ? shift.workUnits : 1;
      basePay = Math.round(shift.manualBasePay * units);
    } else if (job) {
      const units = shift.workUnits > 0 ? shift.workUnits : 1;
      basePay = Math.round(job.defaultRate * units);
    }
    appliedHourlyRate = workedHours > 0 ? Math.round(basePay / workedHours) : 0;
  }

  const extraAllowance = Math.max(0, Math.round(shift.extraAllowance || 0));
  const expenseDeduction = Math.max(0, Math.round(shift.expenseDeduction || 0));
  const grossPay = basePay + nightPay + overtimePay + extraAllowance;
  const taxAmount = job
    ? calculateTaxAmount(grossPay, job.taxType, job.customTaxRate)
    : 0;
  const totalDeduction = taxAmount + expenseDeduction;
  const netPay = grossPay - totalDeduction;

  return {
    inputMode,
    appliedHourlyRate,
    workedHours,
    nightHours,
    overtimeHours,
    basePay,
    nightPay,
    overtimePay,
    extraAllowance,
    grossPay,
    taxAmount,
    expenseDeduction,
    totalDeduction,
    netPay,
  };
}

function getMondayOfDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatWeekLabel(mondayStr: string): string {
  const [y, m, d] = mondayStr.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  return `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`;
}

export function calculateMonthlySummary(
  monthKey: string,
  shifts: WorkShift[],
  jobs: JobProfile[],
  filterJobId?: string
): MonthlySummary {
  const jobMap = new Map<string, JobProfile>(jobs.map((j) => [j.id, j]));
  const monthShifts = shifts.filter(
    (s) => s.date.startsWith(monthKey) && (!filterJobId || s.jobId === filterJobId)
  );

  const dayJobSetMap = new Map<string, Set<string>>();
  let totalHours = 0;
  let totalWorkUnits = 0;
  let grossPay = 0;
  let totalTax = 0;
  let totalExpenses = 0;
  let settledNetPay = 0;
  let pendingNetPay = 0;

  const perJobStats = new Map<
    string,
    {
      shiftCount: number;
      days: Set<string>;
      totalHours: number;
      totalWorkUnits: number;
      grossPay: number;
      taxAmount: number;
      expenseDeduction: number;
      settledNetPay: number;
      pendingNetPay: number;
    }
  >();

  for (const shift of monthShifts) {
    const job = jobMap.get(shift.jobId);
    const calc = calculateShift(shift, job);

    if (!dayJobSetMap.has(shift.date)) {
      dayJobSetMap.set(shift.date, new Set());
    }
    dayJobSetMap.get(shift.date)!.add(shift.jobId);

    const shiftUnits = shift.workUnits > 0 ? shift.workUnits : 1;
    totalHours += calc.workedHours;
    totalWorkUnits += shiftUnits;
    grossPay += calc.grossPay;
    totalTax += calc.taxAmount;
    totalExpenses += calc.expenseDeduction;
    if (shift.paymentStatus === 'settled') {
      settledNetPay += calc.netPay;
    } else {
      pendingNetPay += calc.netPay;
    }

    if (!perJobStats.has(shift.jobId)) {
      perJobStats.set(shift.jobId, {
        shiftCount: 0,
        days: new Set(),
        totalHours: 0,
        totalWorkUnits: 0,
        grossPay: 0,
        taxAmount: 0,
        expenseDeduction: 0,
        settledNetPay: 0,
        pendingNetPay: 0,
      });
    }
    const stat = perJobStats.get(shift.jobId)!;
    stat.shiftCount += 1;
    stat.days.add(shift.date);
    stat.totalHours += calc.workedHours;
    stat.totalWorkUnits += shiftUnits;
    stat.grossPay += calc.grossPay;
    stat.taxAmount += calc.taxAmount;
    stat.expenseDeduction += calc.expenseDeduction;
    if (shift.paymentStatus === 'settled') {
      stat.settledNetPay += calc.netPay;
    } else {
      stat.pendingNetPay += calc.netPay;
    }
  }

  const weeklyMap = new Map<
    string,
    { job: JobProfile; mondayStr: string; hours: number; weightedWageSum: number }
  >();

  for (const shift of monthShifts) {
    const job = jobMap.get(shift.jobId);
    if (!job) continue;
    const calc = calculateShift(shift, job);
    const isHourlyMode = calc.inputMode === 'min_wage' || calc.inputMode === 'custom_hourly';
    if (!job.includeWeeklyHolidayPay && !isHourlyMode) continue;
    if (!job.includeWeeklyHolidayPay && job.payType === 'piece') continue;

    const mondayStr = getMondayOfDate(shift.date);
    const key = `${job.id}__${mondayStr}`;
    const hourlyRate =
      calc.appliedHourlyRate > 0
        ? calc.appliedHourlyRate
        : job.payType === 'hourly'
          ? job.defaultRate
          : getMinimumWageForDate(shift.date).wage;

    if (!weeklyMap.has(key)) {
      weeklyMap.set(key, { job, mondayStr, hours: 0, weightedWageSum: 0 });
    }
    const entry = weeklyMap.get(key)!;
    entry.hours += calc.workedHours;
    entry.weightedWageSum += calc.workedHours * hourlyRate;
  }

  const weeklyHolidayBreakdowns: WeeklyHolidayBreakdown[] = [];
  const jobHolidayPayMap = new Map<string, number>();
  let totalWeeklyHolidayPay = 0;

  for (const [key, item] of Array.from(weeklyMap.entries()).sort((a, b) =>
    a[1].mondayStr.localeCompare(b[1].mondayStr)
  )) {
    const eligible = item.hours >= 15;
    const effectiveHourlyRate =
      item.hours > 0 ? Math.round(item.weightedWageSum / item.hours) : item.job.defaultRate;
    const holidayHours = eligible ? Math.min(8, (item.hours / 40) * 8) : 0;
    const holidayPay = eligible ? Math.round(holidayHours * effectiveHourlyRate) : 0;

    totalWeeklyHolidayPay += holidayPay;
    jobHolidayPayMap.set(item.job.id, (jobHolidayPayMap.get(item.job.id) ?? 0) + holidayPay);
    weeklyHolidayBreakdowns.push({
      weekKey: key,
      weekLabel: formatWeekLabel(item.mondayStr),
      jobId: item.job.id,
      jobName: item.job.name,
      totalHours: Math.round(item.hours * 10) / 10,
      effectiveHourlyRate,
      eligible,
      holidayPay,
    });
  }

  const jobSummaries: JobMonthlySummary[] = jobs
    .filter((j) => (!filterJobId || j.id === filterJobId) && (perJobStats.has(j.id) || !j.archived))
    .map((job) => {
      const stat = perJobStats.get(job.id);
      const whPay = jobHolidayPayMap.get(job.id) ?? 0;
      const jobGross = (stat?.grossPay ?? 0) + whPay;
      const jobTax = stat?.taxAmount ?? 0;
      const jobExp = stat?.expenseDeduction ?? 0;
      const jobTotalDeduction = jobTax + jobExp;
      return {
        job,
        shiftCount: stat?.shiftCount ?? 0,
        workedDays: stat?.days.size ?? 0,
        totalHours: Math.round((stat?.totalHours ?? 0) * 10) / 10,
        totalWorkUnits: Math.round((stat?.totalWorkUnits ?? 0) * 10) / 10,
        grossPay: jobGross,
        taxAmount: jobTax,
        expenseDeduction: jobExp,
        totalDeduction: jobTotalDeduction,
        weeklyHolidayPay: whPay,
        netPay: jobGross - jobTotalDeduction,
        settledNetPay: stat?.settledNetPay ?? 0,
        pendingNetPay: (stat?.pendingNetPay ?? 0) + whPay,
      };
    })
    .filter((s) => s.shiftCount > 0 || !s.job.archived);

  const groupMap = new Map<string, GroupMonthlySummary>();
  for (const js of jobSummaries) {
    const gName = js.job.majorCategory || js.job.groupName?.trim() || '주간';
    if (!groupMap.has(gName)) {
      groupMap.set(gName, {
        groupName: gName,
        jobCount: 0,
        shiftCount: 0,
        totalWorkUnits: 0,
        totalHours: 0,
        grossPay: 0,
        taxAmount: 0,
        expenseDeduction: 0,
        totalDeduction: 0,
        weeklyHolidayPay: 0,
        netPay: 0,
        settledNetPay: 0,
        pendingNetPay: 0,
      });
    }
    const g = groupMap.get(gName)!;
    g.jobCount += 1;
    g.shiftCount += js.shiftCount;
    g.totalWorkUnits = Math.round((g.totalWorkUnits + js.totalWorkUnits) * 10) / 10;
    g.totalHours = Math.round((g.totalHours + js.totalHours) * 10) / 10;
    g.grossPay += js.grossPay;
    g.taxAmount += js.taxAmount;
    g.expenseDeduction += js.expenseDeduction;
    g.totalDeduction += js.totalDeduction;
    g.weeklyHolidayPay += js.weeklyHolidayPay;
    g.netPay += js.netPay;
    g.settledNetPay += js.settledNetPay;
    g.pendingNetPay += js.pendingNetPay;
  }

  const groupSummaries = Array.from(groupMap.values()).sort((a, b) => b.netPay - a.netPay);

  const uniqueWorkedDays = dayJobSetMap.size;
  let multiJobDays = 0;
  for (const jobSet of dayJobSetMap.values()) {
    if (jobSet.size >= 2) multiJobDays += 1;
  }

  const totalGrossWithHoliday = grossPay + totalWeeklyHolidayPay;
  const totalDeduction = totalTax + totalExpenses;
  const netPay = totalGrossWithHoliday - totalDeduction;
  const avgDailyNetPay = uniqueWorkedDays > 0 ? Math.round(netPay / uniqueWorkedDays) : 0;
  const avgDailyHours =
    uniqueWorkedDays > 0 ? Math.round((totalHours / uniqueWorkedDays) * 10) / 10 : 0;
  const avgHourlyNetPay = totalHours > 0 ? Math.round(netPay / totalHours) : 0;

  return {
    monthKey,
    totalShifts: monthShifts.length,
    uniqueWorkedDays,
    multiJobDays,
    totalHours: Math.round(totalHours * 10) / 10,
    totalWorkUnits: Math.round(totalWorkUnits * 10) / 10,
    grossPay: totalGrossWithHoliday,
    totalTax,
    totalExpenses,
    totalDeduction,
    totalWeeklyHolidayPay,
    netPay,
    settledNetPay,
    pendingNetPay: pendingNetPay + totalWeeklyHolidayPay,
    avgDailyNetPay,
    avgDailyHours,
    avgHourlyNetPay,
    jobSummaries,
    groupSummaries,
    weeklyHolidayBreakdowns,
  };
}

// 대한민국 연봉 실수령액 계산 (4대보험 + 근로소득세 간이세액 근사)
export function calculateKoreanAnnualSalary(params: {
  annualSalary: number;
  employmentType: EmploymentType;
  contractMonths: number;
  severanceIncluded: boolean;
  nonTaxableMonthly: number;
  dependents: number;
  childrenCount: number;
}): SalaryBreakdown {
  const {
    annualSalary,
    employmentType,
    contractMonths,
    severanceIncluded,
    nonTaxableMonthly,
    dependents,
    childrenCount,
  } = params;

  const safeAnnual = Math.max(0, annualSalary);
  const divisor = severanceIncluded ? 13 : 12;
  const monthlyGross = Math.round(safeAnnual / divisor);
  const safeNonTaxable = Math.min(monthlyGross, Math.max(0, nonTaxableMonthly));
  const monthlyTaxable = Math.max(0, monthlyGross - safeNonTaxable);

  // 1. 국민연금 4.5% (기준소득월액 하한 390,000원 ~ 상한 6,170,000원)
  const pensionBase =
    monthlyTaxable > 0 ? Math.min(6170000, Math.max(390000, monthlyTaxable)) : 0;
  const nationalPension = Math.floor((pensionBase * 0.045) / 10) * 10;

  // 2. 건강보험 3.545%
  const healthInsurance = Math.floor((monthlyTaxable * 0.03545) / 10) * 10;

  // 3. 장기요양보험 (건강보험료의 12.95%)
  const longTermCare = Math.floor((healthInsurance * 0.1295) / 10) * 10;

  // 4. 고용보험 0.9%
  const employmentInsurance = Math.floor((monthlyTaxable * 0.009) / 10) * 10;

  // 5. 근로소득세 (연간 과세급여 기반 근로소득공제 + 인적공제 + 연금보험료공제 + 근로소득세액공제)
  const annualTaxable = monthlyTaxable * 12;
  let earnedIncomeDeduction = 0;
  if (annualTaxable <= 5000000) {
    earnedIncomeDeduction = annualTaxable * 0.7;
  } else if (annualTaxable <= 15000000) {
    earnedIncomeDeduction = 3500000 + (annualTaxable - 5000000) * 0.4;
  } else if (annualTaxable <= 45000000) {
    earnedIncomeDeduction = 7500000 + (annualTaxable - 15000000) * 0.15;
  } else if (annualTaxable <= 100000000) {
    earnedIncomeDeduction = 12000000 + (annualTaxable - 45000000) * 0.05;
  } else {
    earnedIncomeDeduction = 14750000 + (annualTaxable - 100000000) * 0.02;
  }

  const earnedIncomeAmount = Math.max(0, annualTaxable - earnedIncomeDeduction);
  const personalDeduction = Math.max(1, dependents) * 1500000;
  const annualPensionDeduction = nationalPension * 12;
  // 특별소득공제·표준세액공제 근사 반영 (간이세액표 수준 맞춤)
  const specialApprox =
    annualTaxable <= 30000000
      ? 3100000 + annualTaxable * 0.04
      : 3600000 + annualTaxable * 0.02;

  const taxBase = Math.max(
    0,
    earnedIncomeAmount - personalDeduction - annualPensionDeduction - specialApprox
  );

  let calculatedTax = 0;
  if (taxBase <= 14000000) {
    calculatedTax = taxBase * 0.06;
  } else if (taxBase <= 50000000) {
    calculatedTax = 840000 + (taxBase - 14000000) * 0.15;
  } else if (taxBase <= 88000000) {
    calculatedTax = 6240000 + (taxBase - 50000000) * 0.24;
  } else if (taxBase <= 150000000) {
    calculatedTax = 15360000 + (taxBase - 88000000) * 0.35;
  } else if (taxBase <= 300000000) {
    calculatedTax = 37060000 + (taxBase - 150000000) * 0.38;
  } else {
    calculatedTax = 94060000 + (taxBase - 300000000) * 0.4;
  }

  // 근로소득세액공제
  let taxCredit =
    calculatedTax <= 1300000
      ? calculatedTax * 0.55
      : 715000 + (calculatedTax - 1300000) * 0.3;
  const maxCredit =
    annualTaxable <= 33000000 ? 740000 : annualTaxable <= 70000000 ? 660000 : 500000;
  taxCredit = Math.min(taxCredit, maxCredit);

  // 자녀 세액공제
  const childCredit =
    childrenCount <= 0
      ? 0
      : childrenCount === 1
        ? 150000
        : childrenCount === 2
          ? 350000
          : 350000 + (childrenCount - 2) * 300000;

  const annualIncomeTax = Math.max(0, calculatedTax - taxCredit - childCredit);
  const incomeTax =
    monthlyTaxable <= 1060000 ? 0 : Math.floor(annualIncomeTax / 12 / 10) * 10;
  const localIncomeTax = Math.floor((incomeTax * 0.1) / 10) * 10;

  const totalMonthlyDeduction =
    nationalPension +
    healthInsurance +
    longTermCare +
    employmentInsurance +
    incomeTax +
    localIncomeTax;

  const monthlyNet = Math.max(0, monthlyGross - totalMonthlyDeduction);
  const months = employmentType === '계약직' ? Math.max(1, contractMonths) : 12;
  const contractTotalGross = monthlyGross * months;
  const contractTotalNet = monthlyNet * months;
  const annualNet = monthlyNet * 12;
  // 1년(12개월) 이상 근무 시 법정 퇴직금 발생
  const estimatedSeverance = months >= 12 ? monthlyGross : 0;

  return {
    monthlyGross,
    monthlyTaxable,
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    incomeTax,
    localIncomeTax,
    totalMonthlyDeduction,
    monthlyNet,
    annualNet,
    contractTotalGross,
    contractTotalNet,
    estimatedSeverance,
  };
}

export function getCalendarDays(
  monthKey: string,
  weekStartsOnMonday = false
): {
  dateStr: string;
  day: number;
  inCurrentMonth: boolean;
  dayOfWeek: number;
}[] {
  const [year, month] = monthKey.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const startOffset = weekStartsOnMonday
    ? firstDay.getDay() === 0
      ? 6
      : firstDay.getDay() - 1
    : firstDay.getDay();

  const totalDays = lastDay.getDate();
  const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;

  const cells: {
    dateStr: string;
    day: number;
    inCurrentMonth: boolean;
    dayOfWeek: number;
  }[] = [];

  for (let i = 0; i < totalCells; i++) {
    const dt = new Date(year, month - 1, 1 - startOffset + i);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    cells.push({
      dateStr: `${yy}-${mm}-${dd}`,
      day: dt.getDate(),
      inCurrentMonth: dt.getMonth() === month - 1,
      dayOfWeek: dt.getDay(),
    });
  }

  return cells;
}

export function getAdjacentMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const dt = new Date(year, month - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function formatKoreanMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return `${year}년 ${month}월`;
}

export function formatKoreanDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dt = new Date(year, month - 1, day);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${month}월 ${day}일 (${weekdays[dt.getDay()]})`;
}

export function exportShiftsToCSV(
  monthKey: string,
  shifts: WorkShift[],
  jobs: JobProfile[]
): string {
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const rows = shifts
    .filter((s) => s.date.startsWith(monthKey))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const header = [
    '날짜',
    '대분류',
    '소분류',
    '직장명',
    '주소',
    '계산방식',
    '근무시간',
    '실근무(h)',
    '공수',
    '세전수입',
    '세금공제',
    '지출차감',
    '실수령액',
    '정산상태',
    '메모',
  ];

  const lines = rows.map((shift) => {
    const job = jobMap.get(shift.jobId);
    const calc = calculateShift(shift, job);
    const cols = [
      shift.date,
      job?.majorCategory || '주간',
      job?.subCategory || '기타',
      job?.name ?? '미지정',
      `"${(job?.address || '').replace(/"/g, '""')}"`,
      SHIFT_INPUT_MODE_LABELS[calc.inputMode],
      `${shift.startTime}~${shift.endTime}`,
      String(calc.workedHours),
      String(shift.workUnits ?? 1),
      String(calc.grossPay),
      String(calc.taxAmount),
      String(calc.expenseDeduction),
      String(calc.netPay),
      shift.paymentStatus === 'settled' ? '정산완료' : '정산대기',
      `"${(shift.memo || '').replace(/"/g, '""')}"`,
    ];
    return cols.join(',');
  });

  return '\uFEFF' + [header.join(','), ...lines].join('\n');
}
