import React, { useMemo, useState } from 'react';
import { JobProfile, MonthlySummary, WorkShift } from '../types/work';
import {
  JOB_COLOR_STYLES,
  calculateMonthlySummary,
  formatCompactKRW,
  formatHours,
  formatKRW,
  formatKoreanMonth,
  formatSignedKRW,
  getAdjacentMonthKey,
} from '../utils/payroll';

interface AnalyticsViewProps {
  monthKey: string;
  jobs: JobProfile[];
  shifts: WorkShift[];
  summary: MonthlySummary;
  monthlyGoalNetPay: number;
  onUpdateMonthlyGoal: (goal: number) => void;
  onSelectMonth: (monthKey: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  monthKey,
  jobs,
  shifts,
  summary,
  monthlyGoalNetPay,
  onUpdateMonthlyGoal,
  onSelectMonth,
}) => {
  const [goalInput, setGoalInput] = useState(String(monthlyGoalNetPay));

  // 최근 6개월 트렌드 + 전월 대비 비교용 데이터
  const monthlyComparisonRows = useMemo(() => {
    const months: {
      key: string;
      shortLabel: string;
      fullLabel: string;
      summary: MonthlySummary;
      momDiff: number;
      momPercent: number | null;
      goalPercent: number;
    }[] = [];

    for (let i = -5; i <= 0; i++) {
      const mKey = getAdjacentMonthKey(monthKey, i);
      const prevKey = getAdjacentMonthKey(mKey, -1);
      const curSum = calculateMonthlySummary(mKey, shifts, jobs);
      const prevSum = calculateMonthlySummary(prevKey, shifts, jobs);
      const [, m] = mKey.split('-');
      const momDiff = curSum.netPay - prevSum.netPay;
      const momPercent =
        prevSum.netPay > 0 ? Math.round((momDiff / prevSum.netPay) * 1000) / 10 : null;
      const goalPercent =
        monthlyGoalNetPay > 0
          ? Math.round((curSum.netPay / monthlyGoalNetPay) * 1000) / 10
          : 0;

      months.push({
        key: mKey,
        shortLabel: `${Number(m)}월`,
        fullLabel: formatKoreanMonth(mKey),
        summary: curSum,
        momDiff,
        momPercent,
        goalPercent,
      });
    }
    return months;
  }, [monthKey, shifts, jobs, monthlyGoalNetPay]);

  const maxTrendPay = Math.max(
    100000,
    ...monthlyComparisonRows.map((m) => m.summary.netPay),
    monthlyGoalNetPay
  );

  const handleGoalSave = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.max(0, Number(goalInput) || 0);
    onUpdateMonthlyGoal(val);
  };

  return (
    <div className="space-y-6">
      {/* 상단 2단: 알바별 수입 비교 + 최근 6개월 추이 & 목표금액 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 알바(직장)별 수입 비교 */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">알바 · 직장별 수입 비교 (투잡 비중)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                근무처별 실수령액, 공제금액, 실효 시급을 비교합니다
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-700 font-mono-num">
              총 {formatKRW(summary.netPay)}
            </span>
          </div>

          {summary.jobSummaries.length === 0 || summary.netPay === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              이번 달에 기록된 근무가 없어 알바별 비교를 표시할 수 없습니다.
            </p>
          ) : (
            <div className="space-y-4">
              {summary.jobSummaries
                .slice()
                .sort((a, b) => b.netPay - a.netPay)
                .map((item) => {
                  const ratio =
                    summary.netPay > 0
                      ? Math.max(0, Math.round((item.netPay / summary.netPay) * 100))
                      : 0;
                  const style = JOB_COLOR_STYLES[item.job.color];
                  const effectiveHourly =
                    item.totalHours > 0 ? Math.round(item.netPay / item.totalHours) : 0;

                  return (
                    <div key={item.job.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${style.swatch}`} />
                          <span className="font-semibold text-slate-900 truncate">
                            {item.job.name}
                          </span>
                          <span className="text-[11px] text-slate-400 shrink-0">
                            {item.job.majorCategory || '주간'} · {item.job.subCategory || '기타'}
                          </span>
                          <span className="text-slate-500 font-mono-num shrink-0">
                            ({ratio}%)
                          </span>
                        </div>
                        <span className="font-bold text-slate-900 font-mono-num shrink-0">
                          {formatKRW(item.netPay)}
                        </span>
                      </div>

                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${style.barFill}`}
                          style={{ width: `${Math.min(100, ratio)}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono-num">
                        <span>
                          {item.workedDays}일 · {item.shiftCount}건 · {formatHours(item.totalHours)}
                        </span>
                        <span>
                          세전 {formatKRW(item.grossPay)} · 공제 -
                          {formatKRW(item.totalDeduction)} · 실효시급{' '}
                          {formatKRW(effectiveHourly)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* 최근 6개월 실수령액 추이 + 월 목표 설정 */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">목표금액 대비 월별 실수령 추이</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                목표 월수입을 설정하고 최근 6개월 달성 흐름을 비교합니다
              </p>
            </div>
            <form onSubmit={handleGoalSave} className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500 whitespace-nowrap">목표금액</label>
              <input
                type="number"
                min={0}
                step={100000}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="w-28 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md font-mono-num text-right"
              />
              <button
                type="submit"
                className="px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap"
              >
                적용
              </button>
            </form>
          </div>

          <div className="pt-4">
            <div className="relative h-48 flex items-end justify-between gap-3 border-b border-slate-200 pb-2 px-2">
              {monthlyGoalNetPay > 0 && monthlyGoalNetPay <= maxTrendPay && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-blue-400 pointer-events-none flex justify-end"
                  style={{
                    bottom: `${Math.round((monthlyGoalNetPay / maxTrendPay) * 168) + 8}px`,
                  }}
                >
                  <span className="text-[10px] font-medium text-blue-700 bg-white px-1 -mt-2.5 font-mono-num">
                    목표 {formatCompactKRW(monthlyGoalNetPay)}
                  </span>
                </div>
              )}

              {monthlyComparisonRows.map((m) => {
                const heightPx = Math.max(4, Math.round((m.summary.netPay / maxTrendPay) * 160));
                const isCurrent = m.key === monthKey;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => onSelectMonth(m.key)}
                    className="flex-1 flex flex-col items-center gap-1.5 group focus:outline-none"
                    title={`${m.fullLabel} 이동`}
                  >
                    <span className="text-[10px] font-medium text-slate-600 font-mono-num">
                      {m.summary.netPay > 0 ? formatCompactKRW(m.summary.netPay) : '0'}
                    </span>
                    <div
                      className={`w-full max-w-[44px] rounded-t-md transition-colors ${
                        isCurrent ? 'bg-blue-700' : 'bg-slate-300 group-hover:bg-slate-400'
                      }`}
                      style={{ height: `${heightPx}px` }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between px-2 pt-2">
              {monthlyComparisonRows.map((m) => (
                <div
                  key={m.key}
                  className={`flex-1 text-center text-xs font-mono-num ${
                    m.key === monthKey ? 'font-bold text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {m.shortLabel}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* 월별 수입 취합표 (전월 대비 증감 포함) */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">월별 수입 취합표 (전월 대비 증감)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              월을 클릭하면 해당 월의 캘린더와 상세 내역으로 바로 이동합니다
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[780px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">대상 월</th>
                <th className="py-2.5 px-3 text-right">근무일수 (건수)</th>
                <th className="py-2.5 px-3 text-right">월 총 근무시간</th>
                <th className="py-2.5 px-3 text-right">주휴수당</th>
                <th className="py-2.5 px-3 text-right">세전 수입</th>
                <th className="py-2.5 px-3 text-right">공제금액</th>
                <th className="py-2.5 px-3 text-right">예상 실수령액</th>
                <th className="py-2.5 px-3 text-right">전월 대비 증감</th>
                <th className="py-2.5 px-4 text-right">목표 달성률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyComparisonRows
                .slice()
                .reverse()
                .map((row) => {
                  const isCurrent = row.key === monthKey;
                  return (
                    <tr
                      key={row.key}
                      onClick={() => onSelectMonth(row.key)}
                      className={`cursor-pointer transition-colors ${
                        isCurrent ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-bold text-slate-900 whitespace-nowrap font-mono-num">
                        {row.fullLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                        {row.summary.uniqueWorkedDays}일 ({row.summary.totalShifts}건)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                        {formatHours(row.summary.totalHours)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-emerald-700">
                        {row.summary.totalWeeklyHolidayPay > 0
                          ? `+${formatKRW(row.summary.totalWeeklyHolidayPay)}`
                          : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                        {formatKRW(row.summary.grossPay)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-rose-700">
                        -{formatKRW(row.summary.totalDeduction)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono-num text-slate-900">
                        {formatKRW(row.summary.netPay)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold font-mono-num whitespace-nowrap">
                        <span
                          className={
                            row.momDiff > 0
                              ? 'text-emerald-700'
                              : row.momDiff < 0
                                ? 'text-rose-700'
                                : 'text-slate-400'
                          }
                        >
                          {formatSignedKRW(row.momDiff)}
                          {row.momPercent !== null
                            ? ` (${row.momDiff >= 0 ? '+' : ''}${row.momPercent}%)`
                            : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num">
                        <span
                          className={
                            row.goalPercent >= 100
                              ? 'text-emerald-700 font-bold'
                              : 'text-slate-700'
                          }
                        >
                          {row.goalPercent}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 하단: 주차별 주휴수당 자동계산 상세 */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">주차별 주휴수당 자동 계산 내역</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              최저시급·임의시급 근무 또는 주휴수당 포함 직장에서 주 15시간 이상 근무 시 자동 산정됩니다
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 font-mono-num">
            이번 달 주휴수당 합계 +{formatKRW(summary.totalWeeklyHolidayPay)}
          </span>
        </div>

        {summary.weeklyHolidayBreakdowns.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            주휴수당 계산 대상 시급제 근무 기록이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">주차 (월~일)</th>
                  <th className="py-2 px-3">직장</th>
                  <th className="py-2 px-3 text-right">주간 시간</th>
                  <th className="py-2 px-3 text-right">적용 평균 시급</th>
                  <th className="py-2 px-3 text-center">충족 여부</th>
                  <th className="py-2 pl-3 text-right">예상 주휴수당</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.weeklyHolidayBreakdowns.map((row) => (
                  <tr key={row.weekKey}>
                    <td className="py-2 pr-3 font-mono-num text-slate-700">{row.weekLabel}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{row.jobName}</td>
                    <td className="py-2 px-3 text-right font-mono-num text-slate-700">
                      {formatHours(row.totalHours)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-num text-slate-600">
                      {formatKRW(row.effectiveHourlyRate)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`text-[11px] font-medium ${
                          row.eligible ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {row.eligible ? '15시간 이상' : '미달'}
                      </span>
                    </td>
                    <td className="py-2 pl-3 text-right font-bold font-mono-num text-slate-900">
                      {formatKRW(row.holidayPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
