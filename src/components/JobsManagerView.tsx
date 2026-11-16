import React, { useState } from 'react';
import { Archive, Edit3, Plus, RotateCcw } from 'lucide-react';
import {
  JobColorKey,
  JobProfile,
  PayCycle,
  PayType,
  ShiftInputMode,
  TaxType,
} from '../types/work';
import {
  JOB_COLOR_STYLES,
  PAY_CYCLE_LABELS,
  PAY_TYPE_LABELS,
  SHIFT_INPUT_MODE_LABELS,
  TAX_TYPE_LABELS,
  formatKRW,
} from '../utils/payroll';

interface JobsManagerViewProps {
  jobs: JobProfile[];
  onSaveJob: (jobData: Omit<JobProfile, 'id'>, existingId?: string) => void;
  onToggleArchiveJob: (id: string) => void;
}

const COLOR_OPTIONS: JobColorKey[] = ['blue', 'emerald', 'amber', 'violet', 'rose', 'cyan'];
const GROUP_PRESETS = ['물류·현장', '배달·투잡', '매장·알바', '사무·단기', '기타'];

export const JobsManagerView: React.FC<JobsManagerViewProps> = ({
  jobs,
  onSaveJob,
  onToggleArchiveJob,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | undefined>(undefined);

  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('물류·현장');
  const [roleLabel, setRoleLabel] = useState('');
  const [color, setColor] = useState<JobColorKey>('blue');
  const [payType, setPayType] = useState<PayType>('daily');
  const [defaultInputMode, setDefaultInputMode] = useState<ShiftInputMode>('daily_incentive');
  const [defaultRate, setDefaultRate] = useState<string>('150000');
  const [defaultStartTime, setDefaultStartTime] = useState('09:00');
  const [defaultEndTime, setDefaultEndTime] = useState('18:00');
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState('60');
  const [taxType, setTaxType] = useState<TaxType>('daily_tax');
  const [customTaxRate, setCustomTaxRate] = useState('9.4');
  const [payCycle, setPayCycle] = useState<PayCycle>('same_day');
  const [payDayNote, setPayDayNote] = useState('');
  const [enableNightAllowance, setEnableNightAllowance] = useState(false);
  const [enableOvertimeAllowance, setEnableOvertimeAllowance] = useState(false);
  const [includeWeeklyHolidayPay, setIncludeWeeklyHolidayPay] = useState(false);

  const openNewForm = () => {
    setEditingJobId(undefined);
    setName('');
    setGroupName('물류·현장');
    setRoleLabel('');
    setColor(COLOR_OPTIONS[jobs.length % COLOR_OPTIONS.length]);
    setPayType('daily');
    setDefaultInputMode('daily_incentive');
    setDefaultRate('150000');
    setDefaultStartTime('09:00');
    setDefaultEndTime('18:00');
    setDefaultBreakMinutes('60');
    setTaxType('daily_tax');
    setCustomTaxRate('9.4');
    setPayCycle('same_day');
    setPayDayNote('');
    setEnableNightAllowance(false);
    setEnableOvertimeAllowance(false);
    setIncludeWeeklyHolidayPay(false);
    setIsEditing(true);
  };

  const openEditForm = (job: JobProfile) => {
    setEditingJobId(job.id);
    setName(job.name);
    setGroupName(job.groupName || '기타');
    setRoleLabel(job.roleLabel);
    setColor(job.color);
    setPayType(job.payType);
    setDefaultInputMode(
      job.defaultInputMode ||
        (job.payType === 'hourly' ? 'custom_hourly' : 'daily_incentive')
    );
    setDefaultRate(String(job.defaultRate));
    setDefaultStartTime(job.defaultStartTime);
    setDefaultEndTime(job.defaultEndTime);
    setDefaultBreakMinutes(String(job.defaultBreakMinutes));
    setTaxType(job.taxType);
    setCustomTaxRate(String(job.customTaxRate ?? 9.4));
    setPayCycle(job.payCycle);
    setPayDayNote(job.payDayNote || '');
    setEnableNightAllowance(job.enableNightAllowance);
    setEnableOvertimeAllowance(job.enableOvertimeAllowance);
    setIncludeWeeklyHolidayPay(job.includeWeeklyHolidayPay);
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveJob(
      {
        name: name.trim(),
        groupName: groupName.trim() || '기타',
        roleLabel: roleLabel.trim() || '일용직 · 파트타임',
        color,
        payType,
        defaultInputMode,
        defaultRate: Math.max(0, Number(defaultRate) || 0),
        defaultStartTime,
        defaultEndTime,
        defaultBreakMinutes: Math.max(0, Number(defaultBreakMinutes) || 0),
        taxType,
        customTaxRate:
          taxType === 'four_insurance' || taxType === 'custom'
            ? Math.max(0, Number(customTaxRate) || 0)
            : undefined,
        payCycle,
        payDayNote: payDayNote.trim(),
        enableNightAllowance,
        enableOvertimeAllowance,
        includeWeeklyHolidayPay,
      },
      editingJobId
    );
    setIsEditing(false);
  };

  const activeJobs = jobs.filter((j) => !j.archived);
  const archivedJobs = jobs.filter((j) => j.archived);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">직장 · 그룹 설정 (투잡 · N잡)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            근무처별 그룹, 기본 급여 입력 방식(최저시급/임의시급/일당+인센티브), 세금 및 주휴수당 기준을 설정합니다.
          </p>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={openNewForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            새 직장 추가
          </button>
        )}
      </div>

      {isEditing && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              {editingJobId ? '직장 정보 수정' : '새 직장 등록'}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                직장명 *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 쿠팡 물류센터, 배민 커넥트"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                소속 그룹 (공수·정산 그룹)
              </label>
              <input
                type="text"
                list="group-presets"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="예: 물류·현장"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <datalist id="group-presets">
                {GROUP_PRESETS.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                업무 설명
              </label>
              <input
                type="text"
                value={roleLabel}
                onChange={(e) => setRoleLabel(e.target.value)}
                placeholder="예: 주간 상하차 / 저녁 배달"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                캘린더 구분 색상
              </label>
              <div className="flex items-center gap-2 pt-1.5">
                {COLOR_OPTIONS.map((c) => {
                  const st = JOB_COLOR_STYLES[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      aria-label={st.label}
                      className={`w-7 h-7 rounded-md ${st.swatch} transition-transform ${
                        color === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : 'opacity-70 hover:opacity-100'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">급여 형태</label>
              <select
                value={payType}
                onChange={(e) => {
                  const next = e.target.value as PayType;
                  setPayType(next);
                  if (next === 'hourly') {
                    setDefaultInputMode('custom_hourly');
                    setIncludeWeeklyHolidayPay(true);
                    if (Number(defaultRate) > 50000) setDefaultRate('12000');
                  } else {
                    setDefaultInputMode('daily_incentive');
                    if (Number(defaultRate) < 30000) setDefaultRate('150000');
                  }
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {(['daily', 'hourly', 'piece'] as PayType[]).map((t) => (
                  <option key={t} value={t}>
                    {PAY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                기본 근무 입력 방식
              </label>
              <select
                value={defaultInputMode}
                onChange={(e) => setDefaultInputMode(e.target.value as ShiftInputMode)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {(['min_wage', 'custom_hourly', 'daily_incentive'] as ShiftInputMode[]).map((m) => (
                  <option key={m} value={m}>
                    {SHIFT_INPUT_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {payType === 'hourly' ? '기본 시급 (원)' : '1공수 일당 / 기본액 (원)'}
              </label>
              <input
                type="number"
                min={0}
                step={payType === 'hourly' ? 100 : 1000}
                required
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">세금 · 공제 방식</label>
              <select
                value={taxType}
                onChange={(e) => setTaxType(e.target.value as TaxType)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {(['daily_tax', 'freelance_3_3', 'four_insurance', 'custom', 'none'] as TaxType[]).map(
                  (t) => (
                    <option key={t} value={t}>
                      {TAX_TYPE_LABELS[t]}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {(taxType === 'four_insurance' || taxType === 'custom') && (
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                적용 공제율 (%)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                step={0.1}
                value={customTaxRate}
                onChange={(e) => setCustomTaxRate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
              />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">기본 출근</label>
              <input
                type="time"
                value={defaultStartTime}
                onChange={(e) => setDefaultStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">기본 퇴근</label>
              <input
                type="time"
                value={defaultEndTime}
                onChange={(e) => setDefaultEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">기본 휴게 (분)</label>
              <input
                type="number"
                min={0}
                step={10}
                value={defaultBreakMinutes}
                onChange={(e) => setDefaultBreakMinutes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">정산 주기</label>
              <select
                value={payCycle}
                onChange={(e) => setPayCycle(e.target.value as PayCycle)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                {(['same_day', 'weekly', 'monthly'] as PayCycle[]).map((c) => (
                  <option key={c} value={c}>
                    {PAY_CYCLE_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-5 pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={enableNightAllowance}
                onChange={(e) => setEnableNightAllowance(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              야간수당 자동 가산 (22:00~06:00, +50%)
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={enableOvertimeAllowance}
                onChange={(e) => setEnableOvertimeAllowance(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              연장수당 자동 가산 (일 8시간 초과, +50%)
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWeeklyHolidayPay}
                onChange={(e) => setIncludeWeeklyHolidayPay(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              주휴수당 월 수입에 자동 합산 (주 15시간 이상)
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              급여일 메모 (선택)
            </label>
            <input
              type="text"
              value={payDayNote}
              onChange={(e) => setPayDayNote(e.target.value)}
              placeholder="예: 익일 오전 입금, 매주 금요일 정산, 매월 10일"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
            >
              직장 저장
            </button>
          </div>
        </form>
      )}

      {/* 활성 직장 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activeJobs.map((job) => {
          const style = JOB_COLOR_STYLES[job.color];
          return (
            <div
              key={job.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-3 h-3 rounded-xs shrink-0 ${style.swatch}`} />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{job.name}</h3>
                      <p className="text-xs text-slate-500 truncate">
                        {job.groupName || '기타'} · {job.roleLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditForm(job)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                      aria-label="직장 수정"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleArchiveJob(job.id)}
                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md"
                      aria-label="직장 보관"
                      title="사용 안 함(보관)"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">급여 기준</span>
                    <span className="font-semibold text-slate-900 font-mono-num">
                      {PAY_TYPE_LABELS[job.payType]} · {formatKRW(job.defaultRate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">기본 시간</span>
                    <span className="text-slate-700 font-mono-num">
                      {job.defaultStartTime}~{job.defaultEndTime} (휴게 {job.defaultBreakMinutes}분)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">세금 공제</span>
                    <span className="text-slate-700">
                      {TAX_TYPE_LABELS[job.taxType]}
                      {(job.taxType === 'four_insurance' || job.taxType === 'custom') &&
                        ` (${job.customTaxRate ?? 9.4}%)`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">정산 주기</span>
                    <span className="text-slate-700">
                      {PAY_CYCLE_LABELS[job.payCycle]}
                      {job.payDayNote ? ` · ${job.payDayNote}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                {[
                  job.enableNightAllowance && '야간수당 1.5x',
                  job.enableOvertimeAllowance && '연장수당 1.5x',
                  job.includeWeeklyHolidayPay && '주휴수당 포함',
                ]
                  .filter(Boolean)
                  .join(' · ') || '기본 급여 계산'}
              </div>
            </div>
          );
        })}
      </div>

      {/* 보관된 직장 */}
      {archivedJobs.length > 0 && (
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <h3 className="text-xs font-semibold text-slate-500">보관된 직장 ({archivedJobs.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {archivedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{job.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono-num">
                    {formatKRW(job.defaultRate)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleArchiveJob(job.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  복원
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
