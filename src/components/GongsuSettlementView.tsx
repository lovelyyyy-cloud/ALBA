import React, { useMemo, useState } from 'react';
import { CheckCheck, Plus } from 'lucide-react';
import { JobProfile, MonthlySummary, TaxType, WorkShift } from '../types/work';
import {
  TAX_TYPE_LABELS,
  calculateTaxAmount,
  formatHours,
  formatKRW,
  formatKoreanDate,
} from '../utils/payroll';

interface GongsuSettlementViewProps {
  monthKey: string;
  selectedDate: string;
  jobs: JobProfile[];
  summary: MonthlySummary;
  onQuickSaveGongsuShift: (data: Omit<WorkShift, 'id' | 'createdAt'>) => void;
  onBulkSettleByJob: (monthKey: string, jobId: string) => void;
  onBulkSettleByGroup: (monthKey: string, groupName: string) => void;
}

export const GongsuSettlementView: React.FC<GongsuSettlementViewProps> = ({
  monthKey,
  selectedDate,
  jobs,
  summary,
  onQuickSaveGongsuShift,
  onBulkSettleByJob,
  onBulkSettleByGroup,
}) => {
  const activeJobs = useMemo(() => jobs.filter((j) => !j.archived), [jobs]);

  const [calcJobId, setCalcJobId] = useState<string>(() => activeJobs[0]?.id || '');
  const selectedJob = useMemo(
    () => activeJobs.find((j) => j.id === calcJobId) || activeJobs[0],
    [activeJobs, calcJobId]
  );

  const [calcDate, setCalcDate] = useState(selectedDate);
  const [dailyWage, setDailyWage] = useState<string>(() =>
    String(selectedJob?.payType === 'hourly' ? selectedJob.defaultRate * 8 : selectedJob?.defaultRate ?? 150000)
  );
  const [gongsu, setGongsu] = useState<string>('1');
  const [incentive, setIncentive] = useState<string>('');
  const [taxTypeOverride, setTaxTypeOverride] = useState<TaxType>(
    selectedJob?.taxType || 'daily_tax'
  );
  const [isSettled, setIsSettled] = useState(false);
  const [memo, setMemo] = useState('');

  const handleSelectJob = (newJobId: string) => {
    setCalcJobId(newJobId);
    const job = activeJobs.find((j) => j.id === newJobId);
    if (job) {
      setDailyWage(String(job.payType === 'hourly' ? job.defaultRate * 8 : job.defaultRate));
      setTaxTypeOverride(job.taxType);
      setIsSettled(job.payCycle === 'same_day');
    }
  };

  const calcResult = useMemo(() => {
    const unitWage = Math.max(0, Number(dailyWage) || 0);
    const units = Math.max(0, Number(gongsu) || 0);
    const inc = Math.max(0, Number(incentive) || 0);
    const basePay = Math.round(unitWage * units);
    const grossPay = basePay + inc;
    const taxAmount = calculateTaxAmount(
      grossPay,
      taxTypeOverride,
      selectedJob?.customTaxRate
    );
    const netPay = grossPay - taxAmount;
    return { unitWage, units, inc, basePay, grossPay, taxAmount, netPay };
  }, [dailyWage, gongsu, incentive, taxTypeOverride, selectedJob]);

  const handleSaveCalculated = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    onQuickSaveGongsuShift({
      date: calcDate,
      jobId: selectedJob.id,
      inputMode: 'daily_incentive',
      startTime: selectedJob.defaultStartTime,
      endTime: selectedJob.defaultEndTime,
      breakMinutes: selectedJob.defaultBreakMinutes,
      workUnits: calcResult.units > 0 ? calcResult.units : 1,
      manualBasePay: calcResult.unitWage,
      extraAllowance: calcResult.inc,
      expenseDeduction: 0,
      paymentStatus: isSettled ? 'settled' : 'pending',
      memo: memo.trim() || `${calcResult.units}공수 계산 입력`,
    });
    setIncentive('');
    setMemo('');
  };

  return (
    <div className="space-y-6">
      {/* 1. 손쉬운 공수 계산기 + 바로 기록 */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">손쉬운 공수 계산기 · 즉시 기록</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              공수(0.5 / 1 / 1.5 / 2공수 등)와 일당, 인센티브를 입력하면 세금 공제 후 실수령액을 즉시 계산하고 기록합니다.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveCalculated} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  직장 · 그룹 선택
                </label>
                <select
                  value={selectedJob?.id || ''}
                  onChange={(e) => handleSelectJob(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {activeJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      [{j.majorCategory || '주간'} · {j.subCategory || '기타'}] {j.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">기록 날짜</label>
                <input
                  type="date"
                  value={calcDate}
                  onChange={(e) => setCalcDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
            </div>

            {/* 공수 프리셋 + 직접 입력 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                공수 선택 (직접 소수점 입력 가능)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[0.5, 1, 1.5, 2].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setGongsu(String(u))}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-colors font-mono-num ${
                      Number(gongsu) === u
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {u}공수
                  </button>
                ))}
                <input
                  type="number"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={gongsu}
                  onChange={(e) => setGongsu(e.target.value)}
                  aria-label="공수 직접 입력"
                  className="px-2.5 py-2 text-xs text-center font-semibold bg-white border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  1공수 일당 (원)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={dailyWage}
                  onChange={(e) => setDailyWage(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  인센티브 (원, 선택)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={incentive}
                  onChange={(e) => setIncentive(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">세금 적용</label>
                <select
                  value={taxTypeOverride}
                  onChange={(e) => setTaxTypeOverride(e.target.value as TaxType)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  {(['daily_tax', 'freelance_3_3', 'four_insurance', 'none'] as TaxType[]).map(
                    (t) => (
                      <option key={t} value={t}>
                        {TAX_TYPE_LABELS[t]}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="현장명 또는 메모 (선택)"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSettled}
                  onChange={(e) => setIsSettled(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700"
                />
                당일 정산 완료로 바로 기록
              </label>
            </div>
          </div>

          {/* 우측 계산 결과 요약 박스 */}
          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>공수 계산 ({calcResult.units}공수 × {formatKRW(calcResult.unitWage)})</span>
                <span className="font-semibold text-slate-900 font-mono-num">
                  {formatKRW(calcResult.basePay)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>인센티브 추가</span>
                <span className="font-semibold text-slate-900 font-mono-num">
                  +{formatKRW(calcResult.inc)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-slate-700">
                <span className="font-medium">세전 합계</span>
                <span className="font-bold font-mono-num">{formatKRW(calcResult.grossPay)}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>세금 공제액</span>
                <span className="font-semibold font-mono-num">
                  -{formatKRW(calcResult.taxAmount)}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-slate-800">예상 실수령액</span>
                <span className="text-2xl font-bold text-blue-700 font-mono-num">
                  {formatKRW(calcResult.netPay)}
                </span>
              </div>
              <button
                type="submit"
                disabled={!selectedJob}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {formatKoreanDate(calcDate)} 근무로 바로 기록하기
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* 2. 그룹별 공수 · 세금 · 정산 현황 */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">대분류(그룹)별 공수 · 세금 · 정산 현황</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              주간·야간·주말 대분류 단위로 이번 달 총 공수와 세금, 미정산 금액을 한 번에 정산 관리합니다
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-700 font-mono-num">
            총 {summary.totalWorkUnits}공수
          </span>
        </div>

        {summary.groupSummaries.length === 0 ? (
          <p className="text-xs text-slate-500 py-10 text-center">
            이번 달에 기록된 그룹별 근무가 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[780px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">그룹명</th>
                  <th className="py-2.5 px-3 text-right">총 공수 (건수)</th>
                  <th className="py-2.5 px-3 text-right">총 근무시간</th>
                  <th className="py-2.5 px-3 text-right">세전 수입</th>
                  <th className="py-2.5 px-3 text-right">세금 · 경비 공제</th>
                  <th className="py-2.5 px-3 text-right">예상 실수령</th>
                  <th className="py-2.5 px-3 text-right">정산완료 / 미정산</th>
                  <th className="py-2.5 px-4 text-right">정산 관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.groupSummaries.map((g) => (
                  <tr key={g.groupName} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {g.groupName}{' '}
                      <span className="font-normal text-slate-500">({g.jobCount}개 직장)</span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900 font-mono-num">
                      {g.totalWorkUnits}공수 ({g.shiftCount}건)
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 font-mono-num">
                      {formatHours(g.totalHours)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 font-mono-num">
                      {formatKRW(g.grossPay)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-700 font-mono-num">
                      -{formatKRW(g.totalDeduction)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono-num">
                      {formatKRW(g.netPay)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num">
                      <span className="text-emerald-700 font-semibold">
                        {formatKRW(g.settledNetPay)}
                      </span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className={g.pendingNetPay > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}>
                        {formatKRW(g.pendingNetPay)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {g.pendingNetPay > 0 ? (
                        <button
                          type="button"
                          onClick={() => onBulkSettleByGroup(monthKey, g.groupName)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 whitespace-nowrap"
                        >
                          <CheckCheck className="w-3 h-3" />
                          일괄 정산
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">정산 완료</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. 직장별 세금 · 공수 · 정산 상세표 */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">직장별 세금 · 정산 상세 관리</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[780px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">직장명 (그룹)</th>
                <th className="py-2.5 px-3">적용 세금</th>
                <th className="py-2.5 px-3 text-right">공수 · 시간</th>
                <th className="py-2.5 px-3 text-right">세전 (주휴포함)</th>
                <th className="py-2.5 px-3 text-right">세금 · 경비</th>
                <th className="py-2.5 px-3 text-right">실수령액</th>
                <th className="py-2.5 px-3 text-right">미정산액</th>
                <th className="py-2.5 px-4 text-right">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.jobSummaries.map((item) => (
                <tr key={item.job.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{item.job.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {item.job.majorCategory || '주간'} · {item.job.subCategory || '기타'}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600">{TAX_TYPE_LABELS[item.job.taxType]}</td>
                  <td className="py-3 px-3 text-right font-mono-num text-slate-700">
                    {item.totalWorkUnits}공수 · {formatHours(item.totalHours)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-slate-700">
                    {formatKRW(item.grossPay)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num text-rose-700">
                    -{formatKRW(item.totalDeduction)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold font-mono-num text-slate-900">
                    {formatKRW(item.netPay)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num font-semibold text-amber-700">
                    {formatKRW(item.pendingNetPay)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {item.pendingNetPay > 0 ? (
                      <button
                        type="button"
                        onClick={() => onBulkSettleByJob(monthKey, item.job.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 whitespace-nowrap"
                      >
                        정산 완료
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">완료</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
