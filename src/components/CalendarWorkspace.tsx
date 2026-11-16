import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Plus,
  Trash2,
} from 'lucide-react';
import { JobProfile, WorkShift } from '../types/work';
import {
  JOB_COLOR_STYLES,
  SHIFT_INPUT_MODE_LABELS,
  calculateShift,
  formatCompactKRW,
  formatHours,
  formatKRW,
  formatKoreanDate,
  getCalendarDays,
} from '../utils/payroll';
import { ShiftEditorForm } from './ShiftEditorForm';

interface CalendarWorkspaceProps {
  monthKey: string;
  jobs: JobProfile[];
  shifts: WorkShift[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  filterJobId: string;
  onChangeFilterJobId: (jobId: string) => void;
  weekStartsOnMonday: boolean;
  todayStr: string;
  onSaveShift: (data: Omit<WorkShift, 'id' | 'createdAt'>, existingId?: string) => void;
  onEditShift: (shift: WorkShift) => void;
  onDeleteShift: (id: string) => void;
  onTogglePaymentStatus: (id: string) => void;
  onQuickAddJobShift: (dateStr: string, job: JobProfile) => void;
  onCopyPreviousDay: (targetDateStr: string) => boolean;
}

export const CalendarWorkspace: React.FC<CalendarWorkspaceProps> = ({
  monthKey,
  jobs,
  shifts,
  selectedDate,
  onSelectDate,
  filterJobId,
  onChangeFilterJobId,
  weekStartsOnMonday,
  todayStr,
  onSaveShift,
  onEditShift,
  onDeleteShift,
  onTogglePaymentStatus,
  onQuickAddJobShift,
  onCopyPreviousDay,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [listSortDesc, setListSortDesc] = useState(true);

  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const activeJobs = useMemo(() => jobs.filter((j) => !j.archived), [jobs]);

  const calendarCells = useMemo(
    () => getCalendarDays(monthKey, weekStartsOnMonday),
    [monthKey, weekStartsOnMonday]
  );

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, WorkShift[]>();
    for (const shift of shifts) {
      if (filterJobId && shift.jobId !== filterJobId) continue;
      if (!map.has(shift.date)) {
        map.set(shift.date, []);
      }
      map.get(shift.date)!.push(shift);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [shifts, filterJobId]);

  const monthDailyGroups = useMemo(() => {
    const dayMap = new Map<string, WorkShift[]>();
    for (const shift of shifts) {
      if (!shift.date.startsWith(monthKey)) continue;
      if (filterJobId && shift.jobId !== filterJobId) continue;
      if (!dayMap.has(shift.date)) {
        dayMap.set(shift.date, []);
      }
      dayMap.get(shift.date)!.push(shift);
    }

    const entries = Array.from(dayMap.entries()).sort((a, b) =>
      listSortDesc ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])
    );

    return entries.map(([dateStr, dayList]) => {
      const sortedShifts = dayList
        .slice()
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const totals = sortedShifts.reduce(
        (acc, s) => {
          const c = calculateShift(s, jobMap.get(s.jobId));
          acc.hours += c.workedHours;
          acc.gross += c.grossPay;
          acc.deduction += c.totalDeduction;
          acc.net += c.netPay;
          return acc;
        },
        { hours: 0, gross: 0, deduction: 0, net: 0 }
      );
      const isMultiJob = new Set(sortedShifts.map((s) => s.jobId)).size >= 2;
      return {
        dateStr,
        shifts: sortedShifts,
        totals,
        isMultiJob,
      };
    });
  }, [shifts, monthKey, filterJobId, listSortDesc, jobMap]);

  const monthListSummary = useMemo(() => {
    return monthDailyGroups.reduce(
      (acc, g) => {
        acc.days += 1;
        acc.count += g.shifts.length;
        acc.hours += g.totals.hours;
        acc.net += g.totals.net;
        return acc;
      },
      { days: 0, count: 0, hours: 0, net: 0 }
    );
  }, [monthDailyGroups]);

  const selectedDayShifts = shiftsByDate.get(selectedDate) || [];
  const selectedDayTotals = useMemo(() => {
    return selectedDayShifts.reduce(
      (acc, s) => {
        const calc = calculateShift(s, jobMap.get(s.jobId));
        acc.gross += calc.grossPay;
        acc.deduction += calc.totalDeduction;
        acc.net += calc.netPay;
        acc.hours += calc.workedHours;
        return acc;
      },
      { gross: 0, deduction: 0, net: 0, hours: 0 }
    );
  }, [selectedDayShifts, jobMap]);

  const weekdayHeaders = weekStartsOnMonday
    ? ['월', '화', '수', '목', '금', '토', '일']
    : ['일', '월', '화', '수', '목', '금', '토'];

  const handleDayClick = (dateStr: string) => {
    onSelectDate(dateStr);
    setIsAdding(false);
    setEditingShift(null);
  };

  const handleCopyPrev = () => {
    const ok = onCopyPreviousDay(selectedDate);
    setCopyFeedback(ok ? '최근 근무를 복사했습니다.' : '복사할 이전 근무가 없습니다.');
    setTimeout(() => setCopyFeedback(null), 2200);
  };

  return (
    <div className="space-y-4">
      {/* 직장 필터 세그먼트 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200/80 rounded-lg overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => onChangeFilterJobId('')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              filterJobId === ''
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            전체 ({activeJobs.length}개 직장)
          </button>
          {activeJobs.map((job) => {
            const style = JOB_COLOR_STYLES[job.color];
            const active = filterJobId === job.id;
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => onChangeFilterJobId(job.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`w-2 h-2 rounded-xs ${style.swatch}`} />
                {job.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>날짜를 클릭해 하루 N건(투잡) 근무와 일 총 근무시간을 확인하세요</span>
        </div>
      </div>

      {/* 메인 캘린더 + 일별 상세 2단 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 좌측: 월간 캘린더 */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70">
            {weekdayHeaders.map((dayLabel) => (
              <div
                key={dayLabel}
                className={`py-2.5 text-center text-xs font-semibold ${
                  dayLabel === '일'
                    ? 'text-rose-600'
                    : dayLabel === '토'
                      ? 'text-blue-600'
                      : 'text-slate-600'
                }`}
              >
                {dayLabel}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 border-b border-slate-200">
            {calendarCells.map((cell) => {
              const dayShifts = shiftsByDate.get(cell.dateStr) || [];
              const isSelected = cell.dateStr === selectedDate;
              const isToday = cell.dateStr === todayStr;

              const dayStats = dayShifts.reduce(
                (acc, s) => {
                  const calc = calculateShift(s, jobMap.get(s.jobId));
                  acc.net += calc.netPay;
                  acc.hours += calc.workedHours;
                  return acc;
                },
                { net: 0, hours: 0 }
              );

              const hasMultiJob = new Set(dayShifts.map((s) => s.jobId)).size >= 2;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => handleDayClick(cell.dateStr)}
                  className={`group relative min-h-[88px] sm:min-h-[112px] p-1.5 sm:p-2 text-left flex flex-col justify-between transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
                    !cell.inCurrentMonth
                      ? 'bg-slate-50/70 text-slate-400'
                      : isSelected
                        ? 'bg-blue-50/50'
                        : 'bg-white hover:bg-slate-50/80'
                  }`}
                >
                  {/* 상단 날짜 숫자 및 투잡 표시 */}
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-md font-mono-num ${
                        isSelected
                          ? 'bg-slate-900 text-white'
                          : isToday
                            ? 'bg-blue-100 text-blue-800'
                            : !cell.inCurrentMonth
                              ? 'text-slate-400'
                              : cell.dayOfWeek === 0
                                ? 'text-rose-600'
                                : cell.dayOfWeek === 6
                                  ? 'text-blue-600'
                                  : 'text-slate-800'
                      }`}
                    >
                      {cell.day}
                    </span>

                    {hasMultiJob && (
                      <span className="text-[10px] font-semibold text-blue-700 hidden sm:inline">
                        투잡
                      </span>
                    )}
                  </div>

                  {/* 근무 바 목록 */}
                  <div className="mt-1 space-y-1 w-full">
                    {dayShifts.slice(0, 2).map((shift) => {
                      const job = jobMap.get(shift.jobId);
                      const style = JOB_COLOR_STYLES[job?.color || 'blue'];
                      const calc = calculateShift(shift, job);
                      return (
                        <div
                          key={shift.id}
                          className={`px-1.5 py-0.5 rounded border text-[10px] sm:text-[11px] leading-tight flex items-center justify-between gap-1 ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
                        >
                          <span className="truncate font-medium">
                            {job?.name.split(' ')[0] || '근무'}
                          </span>
                          <span className="font-mono-num shrink-0 hidden sm:inline">
                            {formatCompactKRW(calc.netPay)}
                          </span>
                        </div>
                      );
                    })}
                    {dayShifts.length > 2 && (
                      <div className="text-[10px] font-medium text-slate-500 px-1">
                        +{dayShifts.length - 2}건 더 있음
                      </div>
                    )}
                  </div>

                  {/* 일 총 근무시간 & 일 실수령 합계 */}
                  {dayShifts.length > 0 && (
                    <div className="mt-1 w-full flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-mono-num">
                      <span className="text-slate-400 hidden sm:inline">
                        {Math.round(dayStats.hours * 10) / 10}h
                      </span>
                      <span className="font-semibold text-slate-700 ml-auto">
                        {formatCompactKRW(dayStats.net)}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 우측: 선택된 날짜 근무 내역 및 빠른 기록 패널 */}
        <aside className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {formatKoreanDate(selectedDate)}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono-num">
                {selectedDayShifts.length > 0
                  ? `일 총 근무시간 ${formatHours(selectedDayTotals.hours)} · ${selectedDayShifts.length}건`
                  : '기록된 근무가 없습니다'}
              </p>
            </div>
            {!isAdding && !editingShift && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                근무 추가
              </button>
            )}
          </div>

          {/* 일별 세전 / 공제 / 실수령 요약 바 */}
          {selectedDayShifts.length > 0 && !isAdding && !editingShift && (
            <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50 border border-slate-200 rounded-lg py-2 px-1 text-center">
              <div>
                <p className="text-[10px] text-slate-500">세전</p>
                <p className="text-xs font-semibold text-slate-800 font-mono-num">
                  {formatKRW(selectedDayTotals.gross)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">공제금액</p>
                <p className="text-xs font-semibold text-rose-700 font-mono-num">
                  -{formatKRW(selectedDayTotals.deduction)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">예상 실수령</p>
                <p className="text-xs font-bold text-blue-700 font-mono-num">
                  {formatKRW(selectedDayTotals.net)}
                </p>
              </div>
            </div>
          )}

          {copyFeedback && (
            <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              {copyFeedback}
            </div>
          )}

          {/* 입력/수정 폼 활성 상태 */}
          {(isAdding || editingShift) ? (
            <ShiftEditorForm
              jobs={jobs}
              initialDate={selectedDate}
              editingShift={editingShift}
              defaultJobId={filterJobId || undefined}
              onSave={(data, existingId) => {
                onSaveShift(data, existingId);
                setIsAdding(false);
                setEditingShift(null);
              }}
              onCancel={() => {
                setIsAdding(false);
                setEditingShift(null);
              }}
            />
          ) : (
            <>
              {/* 당일 근무 리스트 */}
              {selectedDayShifts.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {selectedDayShifts.map((shift) => {
                    const job = jobMap.get(shift.jobId);
                    const style = JOB_COLOR_STYLES[job?.color || 'blue'];
                    const calc = calculateShift(shift, job);

                    return (
                      <div key={shift.id} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${style.swatch}`} />
                              <span className="text-sm font-semibold text-slate-900 truncate">
                                {job?.name || '삭제된 직장'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1 font-mono-num">
                              <span>
                                {shift.startTime}~{shift.endTime}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{formatHours(calc.workedHours)}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-sans text-[11px]">
                                {SHIFT_INPUT_MODE_LABELS[calc.inputMode].split(' ')[0]}
                              </span>
                              {calc.inputMode === 'daily_incentive' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{shift.workUnits}공수</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-slate-900 font-mono-num">
                              {formatKRW(calc.netPay)}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono-num">
                              세전 {formatKRW(calc.grossPay)} · 공제 -{formatKRW(calc.totalDeduction)}
                            </p>
                          </div>
                        </div>

                        {shift.memo && (
                          <p className="text-xs text-slate-600 bg-slate-50 rounded-md px-2.5 py-1.5">
                            {shift.memo}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => onTogglePaymentStatus(shift.id)}
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border transition-colors ${
                              shift.paymentStatus === 'settled'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {shift.paymentStatus === 'settled' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                정산 완료
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                정산 대기
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingShift(shift)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                              aria-label="근무 수정"
                              title="수정"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteShift(shift.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                              aria-label="근무 삭제"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <p className="text-sm text-slate-500">
                    이 날짜에 아직 근무 기록이 없습니다.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyPrev}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    최근 근무 불러와 복사하기
                  </button>
                </div>
              )}

              {/* 원터치 빠른 출근 기록 버튼 */}
              {activeJobs.length > 0 && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      원터치 빠른 기록 (기본 시간·단가 적용)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {activeJobs.map((job) => {
                      const style = JOB_COLOR_STYLES[job.color];
                      return (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => onQuickAddJobShift(selectedDate, job)}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-xs shrink-0 ${style.swatch}`} />
                            <span className="text-xs font-medium text-slate-800 truncate">
                              + {job.name}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-mono-num shrink-0">
                            {job.defaultStartTime}~{job.defaultEndTime}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {/* 하단: 날짜별 전체 근무건수별 리스트 */}
      <section
        aria-label="날짜별 전체 근무 내역"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              날짜별 전체 근무 내역 리스트
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono-num">
              총 {monthListSummary.days}일 · {monthListSummary.count}건 ·{' '}
              {formatHours(monthListSummary.hours)} · 실수령{' '}
              {formatKRW(monthListSummary.net)}
            </p>
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setListSortDesc(true)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                listSortDesc
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              최신순
            </button>
            <button
              type="button"
              onClick={() => setListSortDesc(false)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                !listSortDesc
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              날짜순
            </button>
          </div>
        </div>

        {monthDailyGroups.length === 0 ? (
          <div className="py-10 px-5 text-center text-xs text-slate-500">
            이번 달에 기록된 근무 내역이 없습니다. 위 캘린더에서 날짜를 선택해 근무를 추가하세요.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {monthDailyGroups.map((group) => {
              const isSelected = group.dateStr === selectedDate;
              return (
                <div key={group.dateStr}>
                  {/* 날짜 그룹 헤더 */}
                  <div
                    onClick={() => handleDayClick(group.dateStr)}
                    className={`px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/70' : 'bg-slate-50/80 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-900 font-mono-num">
                        {formatKoreanDate(group.dateStr)}
                      </span>
                      <span className="text-slate-400" aria-hidden="true">·</span>
                      <span className="font-semibold text-blue-700 font-mono-num">
                        {group.shifts.length}건
                      </span>
                      {group.isMultiJob && (
                        <>
                          <span className="text-slate-400" aria-hidden="true">·</span>
                          <span className="font-semibold text-emerald-700">투잡</span>
                        </>
                      )}
                      <span className="text-slate-400" aria-hidden="true">·</span>
                      <span className="text-slate-600 font-mono-num">
                        일 총 {formatHours(group.totals.hours)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono-num">
                      <span className="text-slate-500 hidden sm:inline">
                        세전 {formatKRW(group.totals.gross)}
                      </span>
                      <span className="text-rose-700 hidden sm:inline">
                        공제 -{formatKRW(group.totals.deduction)}
                      </span>
                      <span className="font-bold text-slate-900">
                        일 실수령 {formatKRW(group.totals.net)}
                      </span>
                    </div>
                  </div>

                  {/* 해당 날짜의 개별 근무건 리스트 */}
                  <div className="divide-y divide-slate-100">
                    {group.shifts.map((shift, idx) => {
                      const job = jobMap.get(shift.jobId);
                      const style = JOB_COLOR_STYLES[job?.color || 'blue'];
                      const calc = calculateShift(shift, job);

                      return (
                        <div
                          key={shift.id}
                          className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <span className="text-[11px] font-medium text-slate-400 font-mono-num w-5 shrink-0">
                              #{idx + 1}
                            </span>
                            <span className={`w-2.5 h-2.5 rounded-xs shrink-0 mt-1 sm:mt-0 ${style.swatch}`} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="text-xs font-semibold text-slate-900">
                                  {job?.name || '미지정 직장'}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono-num">
                                  {shift.startTime}~{shift.endTime} ({formatHours(calc.workedHours)})
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {SHIFT_INPUT_MODE_LABELS[calc.inputMode].split(' ')[0]}
                                  {calc.inputMode === 'daily_incentive'
                                    ? ` · ${shift.workUnits}공수`
                                    : ''}
                                </span>
                              </div>
                              {shift.memo && (
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {shift.memo}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 pl-8 sm:pl-0 shrink-0">
                            <div className="text-left sm:text-right font-mono-num">
                              <span className="text-xs font-bold text-slate-900">
                                {formatKRW(calc.netPay)}
                              </span>
                              <span className="text-[11px] text-slate-400 ml-1.5">
                                (세전 {formatKRW(calc.grossPay)} / -{formatKRW(calc.totalDeduction)})
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => onTogglePaymentStatus(shift.id)}
                              className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap ${
                                shift.paymentStatus === 'settled'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              {shift.paymentStatus === 'settled' ? '정산완료' : '정산대기'}
                            </button>

                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => onEditShift(shift)}
                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                aria-label="근무 수정"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteShift(shift.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                                aria-label="근무 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
