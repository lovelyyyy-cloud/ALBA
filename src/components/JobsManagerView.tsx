import React, { useMemo, useState } from 'react';
import { Archive, Edit3, ExternalLink, MapPin, Plus, RotateCcw } from 'lucide-react';
import {
  JobColorKey,
  JobMajorCategory,
  JobProfile,
  PayCycle,
  PayType,
  ShiftInputMode,
  TaxType,
} from '../types/work';
import {
  JOB_COLOR_STYLES,
  MAJOR_CATEGORIES,
  PAY_CYCLE_LABELS,
  PAY_TYPE_LABELS,
  SHIFT_INPUT_MODE_LABELS,
  SUB_CATEGORY_PRESETS,
  TAX_TYPE_LABELS,
  formatKRW,
} from '../utils/payroll';

interface JobsManagerViewProps {
  jobs: JobProfile[];
  onSaveJob: (jobData: Omit<JobProfile, 'id'>, existingId?: string) => void;
  onToggleArchiveJob: (id: string) => void;
}

const COLOR_OPTIONS: JobColorKey[] = ['blue', 'emerald', 'amber', 'violet', 'rose', 'cyan'];

export const JobsManagerView: React.FC<JobsManagerViewProps> = ({
  jobs,
  onSaveJob,
  onToggleArchiveJob,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | undefined>(undefined);
  const [majorFilter, setMajorFilter] = useState<'전체' | JobMajorCategory>('전체');

  // 대분류 · 소분류 상태
  const [majorCategory, setMajorCategory] = useState<JobMajorCategory>('주간');
  const [subCategory, setSubCategory] = useState<string>('물류센터');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [addressSearchKeyword, setAddressSearchKeyword] = useState('');
  const [roleLabel, setRoleLabel] = useState('');

  // 급여 · 시간 · 세금 상태
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
    setMajorCategory('주간');
    setSubCategory('물류센터');
    setName('');
    setAddress('');
    setAddressSearchKeyword('');
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
    setMajorCategory(job.majorCategory || '주간');
    setSubCategory(job.subCategory || '기타');
    setName(job.name);
    setAddress(job.address || '');
    setAddressSearchKeyword(job.address || job.name);
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

  const handleSelectMajorCategory = (cat: JobMajorCategory) => {
    setMajorCategory(cat);
    if (cat === '야간' || cat === '주말(야간)') {
      setDefaultStartTime('21:00');
      setDefaultEndTime('06:00');
      setEnableNightAllowance(true);
    } else {
      setDefaultStartTime('09:00');
      setDefaultEndTime('18:00');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveJob(
      {
        name: name.trim(),
        majorCategory,
        subCategory: subCategory.trim() || '기타',
        address: address.trim(),
        groupName: majorCategory,
        roleLabel: roleLabel.trim() || `${majorCategory} · ${subCategory.trim() || '근무'}`,
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

  const activeJobs = useMemo(
    () =>
      jobs.filter(
        (j) =>
          !j.archived &&
          (majorFilter === '전체' || (j.majorCategory || '주간') === majorFilter)
      ),
    [jobs, majorFilter]
  );
  const archivedJobs = jobs.filter((j) => j.archived);

  const naverSearchQuery = (addressSearchKeyword || address || name || subCategory).trim();
  const naverMapSearchUrl = `https://map.naver.com/p/search/${encodeURIComponent(
    naverSearchQuery || '물류센터'
  )}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">근무처 관리 (대분류 · 소분류)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            대분류(주간/야간/주말)와 소분류(업종 분류·직장명·선택 주소)별로 투잡·N잡 근무처를 등록합니다.
          </p>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={openNewForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            새 근무처 추가
          </button>
        )}
      </div>

      {/* 대분류 필터 바 */}
      {!isEditing && (
        <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg w-fit max-w-full overflow-x-auto">
          {(['전체', ...MAJOR_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setMajorFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                majorFilter === cat
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {isEditing && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              {editingJobId ? '근무처 정보 수정' : '새 근무처 등록'}
            </h3>
          </div>

          {/* 1. 대분류 선택 */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              1. 대분류 (근무 시간대)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MAJOR_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleSelectMajorCategory(cat)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                    majorCategory === cat
                      ? 'border-blue-600 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 2. 소분류 (업종 분류 + 직장명 + 선택 주소 검색) */}
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700">
              2. 소분류 (업종 · 직장명 · 주소)
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  소분류 업종 *
                </label>
                <input
                  type="text"
                  required
                  list="subcategory-presets"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  placeholder="예: 물류센터, 식당, 카페"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <datalist id="subcategory-presets">
                  {SUB_CATEGORY_PRESETS.map((sub) => (
                    <option key={sub} value={sub} />
                  ))}
                </datalist>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['물류센터', '식당', '카페·베이커리', '배달·라이더', '건설·현장'].map(
                    (preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSubCategory(preset)}
                        className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                          subCategory === preset
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  직장명 *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!addressSearchKeyword) setAddressSearchKeyword(e.target.value);
                  }}
                  placeholder="예: 쿠팡 동탄센터, 본죽 역삼점"
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
                          color === c
                            ? 'ring-2 ring-offset-2 ring-slate-900 scale-105'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 주소 입력 및 네이버지도 검색 (필수 아님) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-8">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  근무지 주소 <span className="text-slate-400 font-normal">(선택 · 필수항목 아님)</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setAddressSearchKeyword(e.target.value);
                    }}
                    placeholder="네이버 지도에서 검색한 주소를 붙여넣거나 직접 입력 (비워둬도 무방)"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="md:col-span-4">
                <a
                  href={naverMapSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  네이버 지도 주소 검색
                </a>
              </div>
            </div>
          </div>

          {/* 3. 급여 · 세금 설정 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                업무 메모 (선택)
              </label>
              <input
                type="text"
                value={roleLabel}
                onChange={(e) => setRoleLabel(e.target.value)}
                placeholder="예: 상하차 · 피킹, 홀 서빙"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
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
              근무처 저장
            </button>
          </div>
        </form>
      )}

      {/* 활성 근무처 목록 */}
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
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className={`w-3 h-3 rounded-xs shrink-0 mt-1 ${style.swatch}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
                        <span>{job.majorCategory || '주간'}</span>
                        <span aria-hidden="true" className="text-slate-300">/</span>
                        <span className="text-slate-600">{job.subCategory || '기타'}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                        {job.name}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">{job.roleLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditForm(job)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                      aria-label="근무처 수정"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleArchiveJob(job.id)}
                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md"
                      aria-label="근무처 보관"
                      title="사용 안 함(보관)"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {job.address && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 bg-slate-50 rounded-md px-2.5 py-1.5">
                    <span className="truncate">{job.address}</span>
                    <a
                      href={`https://map.naver.com/p/search/${encodeURIComponent(job.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:underline shrink-0 font-medium"
                    >
                      지도
                    </a>
                  </div>
                )}

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

      {/* 보관된 근무처 */}
      {archivedJobs.length > 0 && (
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <h3 className="text-xs font-semibold text-slate-500">보관된 근무처 ({archivedJobs.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {archivedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    [{job.majorCategory || '주간'} · {job.subCategory || '기타'}] {job.name}
                  </p>
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
