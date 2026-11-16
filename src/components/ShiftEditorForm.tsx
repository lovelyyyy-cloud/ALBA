import React, { useEffect, useMemo, useState } from 'react';
import { JobProfile, PaymentStatus, ShiftInputMode, WorkShift } from '../types/work';
import {
  JOB_COLOR_STYLES,
  calculateShift,
  formatHours,
  formatKRW,
  getMinimumWageForDate,
  resolveShiftInputMode,
} from '../utils/payroll';

interface ShiftEditorFormProps {
  jobs: JobProfile[];
  initialDate: string;
  editingShift?: WorkShift | null;
  defaultJobId?: string;
  onSave: (shiftData: Omit<WorkShift, 'id' | 'createdAt'>, existingId?: string) => void;
  onCancel: () => void;
}

export const ShiftEditorForm: React.FC<ShiftEditorFormProps> = ({
  jobs,
  initialDate,
  editingShift,
  defaultJobId,
  onSave,
  onCancel,
}) => {
  const activeJobs = useMemo(
    () => jobs.filter((j) => !j.archived || j.id === editingShift?.jobId),
    [jobs, editingShift]
  );

  const initialJob = useMemo(() => {
    const targetId = editingShift?.jobId || defaultJobId || activeJobs[0]?.id;
    return activeJobs.find((j) => j.id === targetId) || activeJobs[0];
  }, [activeJobs, editingShift, defaultJobId]);

  const [date, setDate] = useState(editingShift?.date || initialDate);
  const [jobId, setJobId] = useState(initialJob?.id || '');
  const [inputMode, setInputMode] = useState<ShiftInputMode>(() =>
    editingShift
      ? resolveShiftInputMode(editingShift, initialJob)
      : initialJob?.defaultInputMode ||
        (initialJob?.payType === 'hourly' ? 'custom_hourly' : 'daily_incentive')
  );

  const [startTime, setStartTime] = useState(
    editingShift?.startTime || initialJob?.defaultStartTime || '09:00'
  );
  const [endTime, setEndTime] = useState(
    editingShift?.endTime || initialJob?.defaultEndTime || '18:00'
  );
  const [breakMinutes, setBreakMinutes] = useState(
    editingShift?.breakMinutes ?? initialJob?.defaultBreakMinutes ?? 60
  );

  // 임의 시급 (custom_hourly 모드)
  const [hourlyRateInput, setHourlyRateInput] = useState<string>(() => {
    if (editingShift?.hourlyRateOverride !== undefined) {
      return String(editingShift.hourlyRateOverride);
    }
    if (initialJob?.payType === 'hourly') return String(initialJob.defaultRate);
    return String(getMinimumWageForDate(initialDate).wage);
  });

  // 일당 + 인센티브 (daily_incentive 모드)
  const [workUnits, setWorkUnits] = useState(editingShift?.workUnits ?? 1);
  const [dailyRateInput, setDailyRateInput] = useState<string>(() => {
    if (editingShift?.manualBasePay !== undefined && editingShift?.manualBasePay !== null) {
      return String(editingShift.manualBasePay);
    }
    if (initialJob && initialJob.payType !== 'hourly') {
      return String(initialJob.defaultRate);
    }
    return '145000';
  });

  const [incentiveAmount, setIncentiveAmount] = useState<string>(
    editingShift?.extraAllowance ? String(editingShift.extraAllowance) : ''
  );
  const [expenseDeduction, setExpenseDeduction] = useState<string>(
    editingShift?.expenseDeduction ? String(editingShift.expenseDeduction) : ''
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    editingShift?.paymentStatus ||
      (initialJob?.payCycle === 'same_day' ? 'settled' : 'pending')
  );
  const [memo, setMemo] = useState(editingShift?.memo || '');

  const selectedJob = useMemo(
    () => activeJobs.find((j) => j.id === jobId) || activeJobs[0],
    [activeJobs, jobId]
  );

  const minWageInfo = useMemo(() => getMinimumWageForDate(date), [date]);

  // 직장 변경 시 신규 입력 모드라면 기본값 적용
  useEffect(() => {
    if (!editingShift && selectedJob) {
      setStartTime(selectedJob.defaultStartTime);
      setEndTime(selectedJob.defaultEndTime);
      setBreakMinutes(selectedJob.defaultBreakMinutes);
      setWorkUnits(1);
      const nextMode: ShiftInputMode =
        selectedJob.defaultInputMode ||
        (selectedJob.payType === 'hourly' ? 'custom_hourly' : 'daily_incentive');
      setInputMode(nextMode);
      if (selectedJob.payType === 'hourly') {
        setHourlyRateInput(String(selectedJob.defaultRate));
      } else {
        setDailyRateInput(String(selectedJob.defaultRate));
      }
      setPaymentStatus(selectedJob.payCycle === 'same_day' ? 'settled' : 'pending');
    }
  }, [jobId, editingShift, selectedJob]);

  const draftShift: WorkShift = useMemo(
    () => ({
      id: editingShift?.id || 'draft',
      date,
      jobId,
      inputMode,
      hourlyRateOverride:
        inputMode === 'custom_hourly' ? Math.max(0, Number(hourlyRateInput) || 0) : undefined,
      startTime,
      endTime,
      breakMinutes: Math.max(0, Number(breakMinutes) || 0),
      workUnits: inputMode === 'daily_incentive' ? Math.max(0.1, Number(workUnits) || 1) : 1,
      manualBasePay:
        inputMode === 'daily_incentive' ? Math.max(0, Number(dailyRateInput) || 0) : undefined,
      extraAllowance: Math.max(0, Number(incentiveAmount) || 0),
      expenseDeduction: Math.max(0, Number(expenseDeduction) || 0),
      paymentStatus,
      memo: memo.trim(),
      createdAt: '',
    }),
    [
      editingShift,
      date,
      jobId,
      inputMode,
      hourlyRateInput,
      startTime,
      endTime,
      breakMinutes,
      workUnits,
      dailyRateInput,
      incentiveAmount,
      expenseDeduction,
      paymentStatus,
      memo,
    ]
  );

  const previewCalc = useMemo(
    () => calculateShift(draftShift, selectedJob),
    [draftShift, selectedJob]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    onSave(
      {
        date: draftShift.date,
        jobId: selectedJob.id,
        inputMode: draftShift.inputMode,
        hourlyRateOverride: draftShift.hourlyRateOverride,
        startTime: draftShift.startTime,
        endTime: draftShift.endTime,
        breakMinutes: draftShift.breakMinutes,
        workUnits: draftShift.workUnits,
        manualBasePay: draftShift.manualBasePay,
        extraAllowance: draftShift.extraAllowance,
        expenseDeduction: draftShift.expenseDeduction,
        paymentStatus: draftShift.paymentStatus,
        memo: draftShift.memo,
      },
      editingShift?.id
    );
  };

  if (activeJobs.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-600 bg-slate-50 rounded-lg border border-slate-200">
        등록된 직장이 없습니다. 먼저 ‘직장·그룹 설정’에서 근무처를 추가해주세요.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">근무 날짜</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">정산 상태</label>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setPaymentStatus('settled')}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                paymentStatus === 'settled'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              정산 완료
            </button>
            <button
              type="button"
              onClick={() => setPaymentStatus('pending')}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                paymentStatus === 'pending'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              정산 대기
            </button>
          </div>
        </div>
      </div>

      {/* 직장 선택 (투잡 구분) */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          근무처 선택 (투잡·N잡)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {activeJobs.map((job) => {
            const colorStyle = JOB_COLOR_STYLES[job.color];
            const isSelected = job.id === selectedJob?.id;
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => setJobId(job.id)}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-left rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/60 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${colorStyle.swatch}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{job.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {job.majorCategory || '주간'} · {job.subCategory || '기타'}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 shrink-0 font-mono-num">
                  {job.payType === 'hourly'
                    ? `${job.defaultRate.toLocaleString()}원/시`
                    : `${job.defaultRate.toLocaleString()}원`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 급여 계산 입력 방식 3종 선택 */}
      <div className="pt-1 border-t border-slate-100 space-y-2">
        <label className="block text-xs font-semibold text-slate-700">급여 계산 방식</label>
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setInputMode('min_wage')}
            className={`py-1.5 px-2 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
              inputMode === 'min_wage'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            최저시급 자동
          </button>
          <button
            type="button"
            onClick={() => setInputMode('custom_hourly')}
            className={`py-1.5 px-2 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
              inputMode === 'custom_hourly'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            임의 시급 입력
          </button>
          <button
            type="button"
            onClick={() => setInputMode('daily_incentive')}
            className={`py-1.5 px-2 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
              inputMode === 'daily_incentive'
                ? 'bg-white text-blue-700 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            일당+인센티브
          </button>
        </div>
      </div>

      {/* 출근 · 퇴근 · 휴게 시간 */}
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">출근시간</label>
          <input
            type="time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">퇴근시간</label>
          <input
            type="time"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">휴게 (분)</label>
          <input
            type="number"
            min={0}
            max={360}
            step={10}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value))}
            className="w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
          />
        </div>
      </div>

      {/* 선택된 입력 방식별 세부 입력 */}
      {inputMode === 'min_wage' && (
        <div className="bg-blue-50/60 border border-blue-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
          <span className="text-blue-900 font-medium">
            {minWageInfo.year}년 법정 최저시급 자동 적용
          </span>
          <span className="font-bold text-blue-800 font-mono-num">
            시급 {formatKRW(minWageInfo.wage)} × {formatHours(previewCalc.workedHours)}
          </span>
        </div>
      )}

      {inputMode === 'custom_hourly' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-600">임의 시급 입력 (원)</label>
            <span className="text-[11px] text-slate-500 font-mono-num">
              실근무 {formatHours(previewCalc.workedHours)}
            </span>
          </div>
          <input
            type="number"
            min={0}
            step={100}
            required
            value={hourlyRateInput}
            onChange={(e) => setHourlyRateInput(e.target.value)}
            placeholder="예: 12500"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
          />
        </div>
      )}

      {inputMode === 'daily_incentive' && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-600">공수 선택</label>
              <span className="text-[11px] text-slate-500 font-mono-num">
                실근무 {formatHours(previewCalc.workedHours)}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[0.5, 1, 1.5, 2].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setWorkUnits(u)}
                  className={`py-1.5 text-xs font-medium rounded-lg border transition-colors font-mono-num ${
                    workUnits === u
                      ? 'border-blue-600 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {u}공수
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              1공수 기준 일당 (원)
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              required
              value={dailyRateInput}
              onChange={(e) => setDailyRateInput(e.target.value)}
              placeholder="예: 145000"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
            />
          </div>
        </div>
      )}

      {/* 인센티브(선택) + 경비 차감 */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            인센티브 · 식대 (선택, 원)
          </label>
          <input
            type="number"
            min={0}
            step={1000}
            value={incentiveAmount}
            onChange={(e) => setIncentiveAmount(e.target.value)}
            placeholder="없으면 비워두기"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            경비 차감 · 유류비 (원)
          </label>
          <input
            type="number"
            min={0}
            step={500}
            value={expenseDeduction}
            onChange={(e) => setExpenseDeduction(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
          />
        </div>
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">메모 (현장명 · 특이사항)</label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 냉동창고 피킹, 식사 제공, 인센티브 포함 등"
          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {/* 실시간 계산 미리보기 (일 근무시간 / 세전 / 공제금액 / 예상 실수령액) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            일 근무시간 <strong className="text-slate-900 font-mono-num">{formatHours(previewCalc.workedHours)}</strong>
            {previewCalc.nightPay > 0 && ` · 야간 +${formatKRW(previewCalc.nightPay)}`}
            {previewCalc.overtimePay > 0 && ` · 연장 +${formatKRW(previewCalc.overtimePay)}`}
          </span>
          <span className="font-mono-num">세전 {formatKRW(previewCalc.grossPay)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>공제금액 (세금 {formatKRW(previewCalc.taxAmount)} + 경비 {formatKRW(previewCalc.expenseDeduction)})</span>
          <span className="text-rose-700 font-mono-num">
            -{formatKRW(previewCalc.totalDeduction)}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
          <span className="text-xs font-semibold text-slate-800">예상 실수령액</span>
          <span className="text-base font-bold text-blue-700 font-mono-num">
            {formatKRW(previewCalc.netPay)}
          </span>
        </div>
      </div>

      {/* 저장/취소 버튼 */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
        >
          취소
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          {editingShift ? '수정 저장' : '근무 기록 저장'}
        </button>
      </div>
    </form>
  );
};
