import React from 'react';
import { MonthlySummary } from '../types/work';
import { formatHours, formatKRW, formatSignedKRW } from '../utils/payroll';

interface MonthlySummaryStripProps {
  summary: MonthlySummary;
  prevSummary: MonthlySummary;
  monthlyGoalNetPay: number;
  selectedJobName?: string;
}

export const MonthlySummaryStrip: React.FC<MonthlySummaryStripProps> = ({
  summary,
  prevSummary,
  monthlyGoalNetPay,
  selectedJobName,
}) => {
  const goalRatio =
    monthlyGoalNetPay > 0
      ? Math.min(100, Math.round((summary.netPay / monthlyGoalNetPay) * 100))
      : 0;
  const rawGoalPercent =
    monthlyGoalNetPay > 0 ? Math.round((summary.netPay / monthlyGoalNetPay) * 1000) / 10 : 0;
  const remainingToGoal = monthlyGoalNetPay - summary.netPay;

  const momDiff = summary.netPay - prevSummary.netPay;
  const momPercent =
    prevSummary.netPay > 0
      ? Math.round((momDiff / prevSummary.netPay) * 1000) / 10
      : null;

  return (
    <section
      aria-label="월간 수입 요약"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        {/* 1. 예상 실수령액 + 전월 대비 증감 */}
        <div className="p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
              {selectedJobName ? `${selectedJobName} 실수령` : '예상 실수령액 (세후)'}
            </span>
            {prevSummary.netPay > 0 || summary.netPay > 0 ? (
              <span
                className={`text-[11px] font-semibold font-mono-num whitespace-nowrap ${
                  momDiff > 0
                    ? 'text-emerald-700'
                    : momDiff < 0
                      ? 'text-rose-700'
                      : 'text-slate-500'
                }`}
              >
                전월대비 {formatSignedKRW(momDiff)}
                {momPercent !== null ? ` (${momDiff >= 0 ? '+' : ''}${momPercent}%)` : ''}
              </span>
            ) : null}
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 font-mono-num">
            {formatKRW(summary.netPay)}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono-num">
            <span>전월 {formatKRW(prevSummary.netPay)}</span>
            <span aria-hidden="true">·</span>
            <span>입금 {formatKRW(summary.settledNetPay)}</span>
          </div>
        </div>

        {/* 2. 세전 금액 · 공제금액 · 주휴수당 */}
        <div className="p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
              세전 총수입 · 공제금액
            </span>
            {summary.totalWeeklyHolidayPay > 0 && (
              <span className="text-[11px] font-semibold text-emerald-700 font-mono-num whitespace-nowrap">
                주휴 +{formatKRW(summary.totalWeeklyHolidayPay)}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 font-mono-num">
            {formatKRW(summary.grossPay)}
          </p>
          <div className="flex items-center gap-1.5 text-xs font-mono-num">
            <span className="text-rose-700 font-medium">
              공제 -{formatKRW(summary.totalDeduction)}
            </span>
            <span className="text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-500">
              세금 {formatKRW(summary.totalTax)} / 경비 {formatKRW(summary.totalExpenses)}
            </span>
          </div>
        </div>

        {/* 3. 일 · 월 총 근무시간 및 공수 */}
        <div className="p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
              월 총 근무시간 · 일평균
            </span>
            {summary.multiJobDays > 0 && (
              <span className="text-[11px] font-semibold text-blue-700 whitespace-nowrap">
                투잡 {summary.multiJobDays}일
              </span>
            )}
          </div>
          <p className="text-2xl font-bold tracking-tight text-slate-900 font-mono-num">
            {formatHours(summary.totalHours)}{' '}
            <span className="text-sm font-semibold text-slate-500">
              ({summary.uniqueWorkedDays}일)
            </span>
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono-num">
            <span>일평균 {formatHours(summary.avgDailyHours)}</span>
            <span aria-hidden="true">·</span>
            <span>총 {summary.totalWorkUnits}공수</span>
            <span aria-hidden="true">·</span>
            <span>{summary.totalShifts}건</span>
          </div>
        </div>

        {/* 4. 목표금액 vs 달성금액 */}
        <div className="p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
              목표금액 vs 달성금액
            </span>
            <span className="text-xs font-bold text-blue-700 font-mono-num whitespace-nowrap">
              {rawGoalPercent}% 달성
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-lg font-bold tracking-tight text-slate-900 font-mono-num">
              {formatKRW(summary.netPay)}
            </p>
            <span className="text-xs text-slate-500 font-mono-num whitespace-nowrap">
              / {formatKRW(monthlyGoalNetPay)}
            </span>
          </div>
          <div className="space-y-1">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 rounded-full transition-transform duration-200"
                style={{ width: `${goalRatio}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono-num">
              <span className={remainingToGoal <= 0 ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                {remainingToGoal <= 0
                  ? `목표 초과 +${formatKRW(Math.abs(remainingToGoal))}`
                  : `목표까지 ${formatKRW(remainingToGoal)}`}
              </span>
              <span className="text-amber-700">미정산 {formatKRW(summary.pendingNetPay)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
