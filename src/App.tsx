import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  Calculator,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  RotateCcw,
  Table2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AnalyticsView } from './components/AnalyticsView';
import { CalendarWorkspace } from './components/CalendarWorkspace';
import { GongsuSettlementView } from './components/GongsuSettlementView';
import { JobsManagerView } from './components/JobsManagerView';
import { LedgerTableView } from './components/LedgerTableView';
import { MonthlySummaryStrip } from './components/MonthlySummaryStrip';
import { ShiftEditorForm } from './components/ShiftEditorForm';
import {
  DEFAULT_JOBS,
  DEFAULT_SETTINGS,
  createSampleShiftsForMonth,
  getCurrentMonthKey,
  getTodayDateStr,
} from './data/sampleData';
import { AppSettings, JobProfile, WorkShift } from './types/work';
import {
  calculateMonthlySummary,
  formatKoreanMonth,
  getAdjacentMonthKey,
} from './utils/payroll';

type ActiveTab = 'calendar' | 'ledger' | 'gongsu' | 'jobs' | 'analytics';

const STORAGE_KEY = 'ildang_note_v1';

interface StoredState {
  jobs: JobProfile[];
  shifts: WorkShift[];
  settings: AppSettings;
}

function loadInitialState(): StoredState {
  const currentMonth = getCurrentMonthKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      if (Array.isArray(parsed.jobs) && Array.isArray(parsed.shifts)) {
        const normalizedJobs = parsed.jobs.map((j) => ({
          ...j,
          groupName: j.groupName || '기본 그룹',
        }));
        return {
          jobs: normalizedJobs,
          shifts: parsed.shifts,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        };
      }
    }
  } catch {
    // 손상된 로컬 스토리지는 기본 샘플 데이터로 복구
  }
  return {
    jobs: DEFAULT_JOBS,
    shifts: createSampleShiftsForMonth(currentMonth),
    settings: DEFAULT_SETTINGS,
  };
}

export default function App() {
  const initialState = useMemo(() => loadInitialState(), []);
  const todayStr = useMemo(() => getTodayDateStr(), []);

  const [jobs, setJobs] = useState<JobProfile[]>(initialState.jobs);
  const [shifts, setShifts] = useState<WorkShift[]>(initialState.shifts);
  const [settings, setSettings] = useState<AppSettings>(initialState.settings);

  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [monthKey, setMonthKey] = useState<string>(() => getCurrentMonthKey());
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateStr());
  const [filterJobId, setFilterJobId] = useState<string>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalEditingShift, setModalEditingShift] = useState<WorkShift | null>(null);
  const [confirmResetMode, setConfirmResetMode] = useState<'none' | 'clear' | 'sample'>('none');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const payload: StoredState = { jobs, shifts, settings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 스토리지 용량 제한 등 예외 무시
    }
  }, [jobs, shifts, settings]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  const monthlySummary = useMemo(
    () => calculateMonthlySummary(monthKey, shifts, jobs, filterJobId || undefined),
    [monthKey, shifts, jobs, filterJobId]
  );

  const prevMonthKey = useMemo(() => getAdjacentMonthKey(monthKey, -1), [monthKey]);
  const prevMonthlySummary = useMemo(
    () => calculateMonthlySummary(prevMonthKey, shifts, jobs, filterJobId || undefined),
    [prevMonthKey, shifts, jobs, filterJobId]
  );

  const selectedJobName = useMemo(() => {
    if (!filterJobId) return undefined;
    return jobs.find((j) => j.id === filterJobId)?.name;
  }, [filterJobId, jobs]);

  const handleChangeMonth = (delta: number) => {
    const nextMonth = getAdjacentMonthKey(monthKey, delta);
    setMonthKey(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
  };

  const handleSelectMonth = (targetMonthKey: string) => {
    setMonthKey(targetMonthKey);
    setSelectedDate(`${targetMonthKey}-01`);
    setActiveTab('calendar');
  };

  const handleGoToday = () => {
    const curMonth = getCurrentMonthKey();
    setMonthKey(curMonth);
    setSelectedDate(todayStr);
  };

  const handleSaveShift = (
    shiftData: Omit<WorkShift, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      setShifts((prev) =>
        prev.map((s) => (s.id === existingId ? { ...s, ...shiftData } : s))
      );
      showToast('근무 기록을 수정했습니다.');
    } else {
      const newShift: WorkShift = {
        ...shiftData,
        id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setShifts((prev) => [...prev, newShift]);
      setMonthKey(shiftData.date.slice(0, 7));
      setSelectedDate(shiftData.date);
      showToast('새 근무를 기록했습니다.');
    }
    setModalOpen(false);
    setModalEditingShift(null);
  };

  const handleDeleteShift = (id: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== id));
    showToast('근무 기록을 삭제했습니다.');
  };

  const handleTogglePaymentStatus = (id: string) => {
    setShifts((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, paymentStatus: s.paymentStatus === 'settled' ? 'pending' : 'settled' }
          : s
      )
    );
  };

  const handleBulkSettleMonth = (targetMonthKey: string, jobId?: string) => {
    setShifts((prev) =>
      prev.map((s) => {
        if (!s.date.startsWith(targetMonthKey)) return s;
        if (jobId && s.jobId !== jobId) return s;
        return { ...s, paymentStatus: 'settled' };
      })
    );
    showToast('미정산 근무를 일괄 정산 완료 처리했습니다.');
  };

  const handleBulkSettleByGroup = (targetMonthKey: string, groupName: string) => {
    const groupJobIds = new Set(
      jobs.filter((j) => (j.groupName || '기타 그룹') === groupName).map((j) => j.id)
    );
    setShifts((prev) =>
      prev.map((s) => {
        if (!s.date.startsWith(targetMonthKey)) return s;
        if (!groupJobIds.has(s.jobId)) return s;
        return { ...s, paymentStatus: 'settled' };
      })
    );
    showToast(`${groupName} 그룹의 미정산 근무를 일괄 정산 완료했습니다.`);
  };

  const handleQuickAddJobShift = (dateStr: string, job: JobProfile) => {
    const newShift: WorkShift = {
      id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: dateStr,
      jobId: job.id,
      inputMode:
        job.defaultInputMode ||
        (job.payType === 'hourly' ? 'custom_hourly' : 'daily_incentive'),
      hourlyRateOverride: job.payType === 'hourly' ? job.defaultRate : undefined,
      startTime: job.defaultStartTime,
      endTime: job.defaultEndTime,
      breakMinutes: job.defaultBreakMinutes,
      workUnits: 1,
      manualBasePay: job.payType !== 'hourly' ? job.defaultRate : undefined,
      extraAllowance: 0,
      expenseDeduction: 0,
      paymentStatus: job.payCycle === 'same_day' ? 'settled' : 'pending',
      memo: '',
      createdAt: new Date().toISOString(),
    };
    setShifts((prev) => [...prev, newShift]);
    showToast(`${job.name} 근무를 빠르게 기록했습니다.`);
  };

  const handleCopyPreviousDay = (targetDateStr: string): boolean => {
    const candidates = shifts
      .filter((s) => s.date < targetDateStr)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (candidates.length === 0) return false;
    const latestDate = candidates[0].date;
    const toCopy = candidates.filter((s) => s.date === latestDate);
    const copied: WorkShift[] = toCopy.map((s, idx) => ({
      ...s,
      id: `shift-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      date: targetDateStr,
      paymentStatus: 'pending',
      createdAt: new Date().toISOString(),
    }));
    setShifts((prev) => [...prev, ...copied]);
    return true;
  };

  const handleSaveJob = (jobData: Omit<JobProfile, 'id'>, existingId?: string) => {
    if (existingId) {
      setJobs((prev) => prev.map((j) => (j.id === existingId ? { ...j, ...jobData } : j)));
      showToast('직장 정보를 수정했습니다.');
    } else {
      const newJob: JobProfile = {
        ...jobData,
        id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      };
      setJobs((prev) => [...prev, newJob]);
      showToast('새 직장을 추가했습니다.');
    }
  };

  const handleToggleArchiveJob = (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, archived: !j.archived } : j))
    );
  };

  const handleExportBackupJSON = () => {
    const payload: StoredState = { jobs, shifts, settings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `일당노트_백업_${todayStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('전체 데이터 JSON 백업을 저장했습니다.');
  };

  const handleImportBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<StoredState>;
        if (!Array.isArray(parsed.jobs) || !Array.isArray(parsed.shifts)) {
          showToast('올바른 일당노트 백업 파일이 아닙니다.');
          return;
        }
        setJobs(parsed.jobs.map((j) => ({ ...j, groupName: j.groupName || '기본 그룹' })));
        setShifts(parsed.shifts);
        if (parsed.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
        }
        showToast('백업 데이터를 불러왔습니다.');
      } catch {
        showToast('JSON 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const navItems: { id: ActiveTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { id: 'calendar', label: '월간 캘린더', shortLabel: '캘린더', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'ledger', label: '근무 내역표', shortLabel: '내역표', icon: <Table2 className="w-4 h-4" /> },
    { id: 'gongsu', label: '공수·정산 관리', shortLabel: '공수·정산', icon: <Calculator className="w-4 h-4" /> },
    { id: 'jobs', label: '직장·그룹 설정', shortLabel: '직장설정', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'analytics', label: '월별 취합·비교', shortLabel: '월별·비교', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  const activeTabTitle = navItems.find((n) => n.id === activeTab)?.label || '월간 캘린더';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* 데스크톱 좌측 사이드바 */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-20">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            일당노트
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="주요 메뉴">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 하단 환경설정 및 데이터 백업 */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>달력 시작 요일</span>
            <button
              type="button"
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  weekStartsOnMonday: !prev.weekStartsOnMonday,
                }))
              }
              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
            >
              {settings.weekStartsOnMonday ? '월요일 시작' : '일요일 시작'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleExportBackupJSON}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            >
              <Download className="w-3 h-3" />
              백업 저장
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            >
              <Upload className="w-3 h-3" />
              불러오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportBackupJSON}
              className="hidden"
            />
          </div>

          {confirmResetMode === 'none' ? (
            <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
              <button
                type="button"
                onClick={() => setConfirmResetMode('sample')}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="w-3 h-3" />
                샘플 복원
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetMode('clear')}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-700"
              >
                <Trash2 className="w-3 h-3" />
                기록 비우기
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
              <p className="text-[11px] text-slate-700 leading-snug">
                {confirmResetMode === 'clear'
                  ? '모든 근무 기록을 비울까요? (직장 설정은 유지)'
                  : '기본 투잡 샘플 데이터(전월 포함)로 초기화할까요?'}
              </p>
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmResetMode('none')}
                  className="px-2 py-1 text-[11px] text-slate-600 bg-white border border-slate-200 rounded"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmResetMode === 'clear') {
                      setShifts([]);
                      showToast('모든 근무 기록을 비웠습니다.');
                    } else {
                      setJobs(DEFAULT_JOBS);
                      setShifts(createSampleShiftsForMonth(monthKey));
                      showToast('샘플 투잡 데이터를 복원했습니다.');
                    }
                    setConfirmResetMode('none');
                  }}
                  className="px-2 py-1 text-[11px] font-medium text-white bg-slate-900 rounded"
                >
                  확인
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* 상단 컨텍스트 헤더 */}
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <span className="lg:hidden text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              일당노트
            </span>
            <span className="hidden lg:inline text-sm font-semibold text-slate-500 whitespace-nowrap">
              {activeTabTitle}
            </span>

            {/* 월 이동 컨트롤 */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleChangeMonth(-1)}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                aria-label="이전 달"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-1.5 text-sm sm:text-base font-bold text-slate-900 font-mono-num whitespace-nowrap">
                {formatKoreanMonth(monthKey)}
              </span>
              <button
                type="button"
                onClick={() => handleChangeMonth(1)}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                aria-label="다음 달"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleGoToday}
                className="ml-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
              >
                오늘
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setModalEditingShift(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              근무 기록
            </button>
          </div>
        </header>

        {/* 메인 뷰포트 */}
        <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-6">
          {/* 상단 월간 수입 KPI 요약 스트립 */}
          <MonthlySummaryStrip
            summary={monthlySummary}
            prevSummary={prevMonthlySummary}
            monthlyGoalNetPay={settings.monthlyGoalNetPay}
            selectedJobName={selectedJobName}
          />

          {/* 탭 콘텐츠 */}
          {activeTab === 'calendar' && (
            <CalendarWorkspace
              monthKey={monthKey}
              jobs={jobs}
              shifts={shifts}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              filterJobId={filterJobId}
              onChangeFilterJobId={setFilterJobId}
              weekStartsOnMonday={settings.weekStartsOnMonday}
              todayStr={todayStr}
              onSaveShift={handleSaveShift}
              onEditShift={(shift) => {
                setModalEditingShift(shift);
                setModalOpen(true);
              }}
              onDeleteShift={handleDeleteShift}
              onTogglePaymentStatus={handleTogglePaymentStatus}
              onQuickAddJobShift={handleQuickAddJobShift}
              onCopyPreviousDay={handleCopyPreviousDay}
            />
          )}

          {activeTab === 'ledger' && (
            <LedgerTableView
              monthKey={monthKey}
              jobs={jobs}
              shifts={shifts}
              filterJobId={filterJobId}
              onChangeFilterJobId={setFilterJobId}
              onOpenNewShiftModal={() => {
                setModalEditingShift(null);
                setModalOpen(true);
              }}
              onEditShift={(shift) => {
                setModalEditingShift(shift);
                setModalOpen(true);
              }}
              onDeleteShift={handleDeleteShift}
              onTogglePaymentStatus={handleTogglePaymentStatus}
              onBulkSettleMonth={handleBulkSettleMonth}
            />
          )}

          {activeTab === 'gongsu' && (
            <GongsuSettlementView
              monthKey={monthKey}
              selectedDate={selectedDate}
              jobs={jobs}
              summary={monthlySummary}
              onQuickSaveGongsuShift={(data) => handleSaveShift(data)}
              onBulkSettleByJob={(mKey, jId) => handleBulkSettleMonth(mKey, jId)}
              onBulkSettleByGroup={handleBulkSettleByGroup}
            />
          )}

          {activeTab === 'jobs' && (
            <JobsManagerView
              jobs={jobs}
              onSaveJob={handleSaveJob}
              onToggleArchiveJob={handleToggleArchiveJob}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              monthKey={monthKey}
              jobs={jobs}
              shifts={shifts}
              summary={monthlySummary}
              monthlyGoalNetPay={settings.monthlyGoalNetPay}
              onUpdateMonthlyGoal={(goal) => {
                setSettings((prev) => ({ ...prev, monthlyGoalNetPay: goal }));
                showToast('월 목표 실수령액을 저장했습니다.');
              }}
              onSelectMonth={handleSelectMonth}
            />
          )}
        </main>
      </div>

      {/* 모바일 하단 네비게이션 */}
      <nav
        aria-label="모바일 메뉴"
        className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-white border-t border-slate-200 grid grid-cols-5 z-20"
      >
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? 'text-blue-700' : 'text-slate-500'
              }`}
            >
              {item.icon}
              <span className="truncate max-w-full px-1">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* 근무 추가/수정 모달 */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="근무 기록 입력"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">
                {modalEditingShift ? '근무 기록 수정' : '새 근무 기록'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setModalEditingShift(null);
                }}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ShiftEditorForm
              jobs={jobs}
              initialDate={modalEditingShift?.date || selectedDate}
              editingShift={modalEditingShift}
              defaultJobId={filterJobId || undefined}
              onSave={handleSaveShift}
              onCancel={() => {
                setModalOpen(false);
                setModalEditingShift(null);
              }}
            />
          </div>
        </div>
      )}

      {/* 토스트 알림 */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-16 lg:bottom-6 right-4 sm:right-6 z-50 px-4 py-2.5 text-xs font-medium text-white bg-slate-900 rounded-lg shadow-md"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
