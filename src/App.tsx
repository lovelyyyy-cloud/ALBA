import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  BarChart3,
  Briefcase,
  Calculator,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  LogIn,
  LogOut,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Table2,
  Trash2,
  Upload,
  UserCircle2,
  Wallet,
  X,
} from 'lucide-react';
import { AccountBookView } from './components/AccountBookView';
import { AnalyticsView } from './components/AnalyticsView';
import { AnnualSalaryCalculatorView } from './components/AnnualSalaryCalculatorView';
import { CalendarWorkspace } from './components/CalendarWorkspace';
import { GongsuSettlementView } from './components/GongsuSettlementView';
import { JobsManagerView } from './components/JobsManagerView';
import { LedgerTableView } from './components/LedgerTableView';
import { MonthlySummaryStrip } from './components/MonthlySummaryStrip';
import { ShiftEditorForm } from './components/ShiftEditorForm';
import {
  DEFAULT_JOBS,
  DEFAULT_SETTINGS,
  createSampleAccountEntriesForMonth,
  createSampleShiftsForMonth,
  getCurrentMonthKey,
  getTodayDateStr,
} from './data/sampleData';
import {
  auth,
  completeGoogleRedirectResult,
  signInWithGoogleRedirect,
  signInWithGoogleSmart,
} from './firebase';
import {
  bulkSettleShifts,
  clearUserRecords,
  createManyAccountEntries,
  createManyShifts,
  createSalarySimulation,
  ensureUserInitialized,
  importBackupToFirestore,
  removeAccountEntry,
  removeSalarySimulation,
  removeShift,
  saveUserPreferences,
  seedSampleUserData,
  subscribeUserAccountEntries,
  subscribeUserJobs,
  subscribeUserPreferences,
  subscribeUserSalarySimulations,
  subscribeUserShifts,
  toggleJobArchived,
  toggleShiftPaymentStatus,
  upsertAccountEntry,
  upsertJob,
  upsertShift,
} from './services/firestoreService';
import {
  AccountBookEntry,
  AppSettings,
  JobProfile,
  SalarySimulation,
  WorkShift,
} from './types/work';
import {
  calculateMonthlySummary,
  formatKoreanMonth,
  getAdjacentMonthKey,
} from './utils/payroll';

type ActiveTab =
  | 'calendar'
  | 'ledger'
  | 'gongsu'
  | 'jobs'
  | 'analytics'
  | 'salary'
  | 'accountbook';

const STORAGE_KEY = 'ildang_note_v1';
const LOCAL_MIGRATION_DISMISSED_KEY = 'ildang_note_local_import_dismissed_v1';

interface StoredState {
  jobs: JobProfile[];
  shifts: WorkShift[];
  settings: AppSettings;
  salarySimulations?: SalarySimulation[];
  accountEntries?: AccountBookEntry[];
}

function normalizeJobs(rawJobs: JobProfile[]): JobProfile[] {
  return rawJobs.map((j) => ({
    ...j,
    majorCategory: j.majorCategory || '주간',
    subCategory: j.subCategory || '기타',
    groupName: j.majorCategory || j.groupName || '주간',
  }));
}

function readLocalStorageState(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    if (Array.isArray(parsed.jobs) && Array.isArray(parsed.shifts)) {
      return {
        jobs: normalizeJobs(parsed.jobs),
        shifts: parsed.shifts,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        salarySimulations: Array.isArray(parsed.salarySimulations)
          ? parsed.salarySimulations
          : [],
        accountEntries: Array.isArray(parsed.accountEntries) ? parsed.accountEntries : [],
      };
    }
  } catch {
    // 손상된 로컬 스토리지 무시
  }
  return null;
}

function loadGuestInitialState(): StoredState {
  const currentMonth = getCurrentMonthKey();
  const saved = readLocalStorageState();
  if (saved) {
    return {
      ...saved,
      accountEntries:
        saved.accountEntries && saved.accountEntries.length > 0
          ? saved.accountEntries
          : createSampleAccountEntriesForMonth(currentMonth),
    };
  }
  return {
    jobs: DEFAULT_JOBS,
    shifts: createSampleShiftsForMonth(currentMonth),
    settings: DEFAULT_SETTINGS,
    salarySimulations: [],
    accountEntries: createSampleAccountEntriesForMonth(currentMonth),
  };
}

function formatAuthErrorMessage(error: unknown): string {
  const errObj = error as { code?: string; message?: string };
  const code = errObj?.code || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google 로그인 창이 닫혔습니다. 다시 시도해 주세요.';
  }
  if (code === 'auth/popup-blocked') {
    return '브라우저에서 로그인 팝업이 차단되었습니다. 팝업 허용 후 다시 시도하거나 아래 리다이렉트 로그인을 이용해 주세요.';
  }
  if (code === 'auth/web-storage-unsupported') {
    return '브라우저의 서드파티 쿠키/저장소가 차단되어 팝업 로그인이 제한되었습니다. 아래 "새 탭에서 열어 로그인" 또는 "리다이렉트 방식으로 로그인"을 이용해 주세요.';
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return `현재 도메인(${host})이 Firebase 인증 허용 도메인에 등록되지 않았습니다. [코드: ${code}]`;
  }
  if (code === 'auth/operation-not-allowed') {
    return `Google 로그인 제공업체가 비활성화되어 있습니다. [코드: ${code}]`;
  }
  if (code === 'auth/network-request-failed') {
    return `네트워크 오류로 로그인 연결에 실패했습니다. [코드: ${code}]`;
  }
  if (code === 'auth/internal-error') {
    return `인증 세션 연결 중 내부 오류가 발생했습니다. 아래 "새 탭에서 열어 로그인" 또는 "리다이렉트 방식으로 로그인"을 시도해 주세요. [코드: ${code}]`;
  }
  return `Google 로그인 중 오류가 발생했습니다. (${code || errObj?.message || '알 수 없는 오류'})`;
}

export default function App() {
  const todayStr = useMemo(() => getTodayDateStr(), []);

  // 인증 및 게스트 모드 상태
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // 앱 데이터 상태 (인증된 사용자는 Firestore, 게스트는 localStorage)
  const [jobs, setJobs] = useState<JobProfile[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [salarySimulations, setSalarySimulations] = useState<SalarySimulation[]>([]);
  const [accountEntries, setAccountEntries] = useState<AccountBookEntry[]>([]);

  // 로컬(게스트) 기록 클라우드 가져오기 배너 상태
  const [pendingLocalImport, setPendingLocalImport] = useState<StoredState | null>(null);
  const [importingLocal, setImportingLocal] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [monthKey, setMonthKey] = useState<string>(() => getCurrentMonthKey());
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateStr());
  const [filterJobId, setFilterJobId] = useState<string>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalEditingShift, setModalEditingShift] = useState<WorkShift | null>(null);
  const [confirmResetMode, setConfirmResetMode] = useState<'none' | 'clear' | 'sample'>('none');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  // Firebase Auth 상태 구독 및 리다이렉트 로그인 결과 확인
  useEffect(() => {
    void completeGoogleRedirectResult().catch((error) => {
      const code = (error as { code?: string })?.code;
      if (code && code !== 'auth/null-user') {
        console.error('[Firebase Redirect Auth Error]', error);
        setAuthError(formatAuthErrorMessage(error));
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setAuthError(null);
      if (nextUser) {
        setGuestMode(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 게스트 모드 진입 시 localStorage 불러오기
  useEffect(() => {
    if (!authReady || user || !guestMode) return;
    const guestState = loadGuestInitialState();
    setJobs(guestState.jobs);
    setShifts(guestState.shifts);
    setSettings(guestState.settings);
    setSalarySimulations(guestState.salarySimulations || []);
    setAccountEntries(guestState.accountEntries || []);
    setCloudLoading(false);
    setCloudError(null);
  }, [authReady, user, guestMode]);

  // 게스트 모드일 때만 localStorage에 저장
  useEffect(() => {
    if (!authReady || user || !guestMode) return;
    try {
      const payload: StoredState = {
        jobs,
        shifts,
        settings,
        salarySimulations,
        accountEntries,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 스토리지 용량 제한 등 예외 무시
    }
  }, [authReady, user, guestMode, jobs, shifts, settings, salarySimulations, accountEntries]);

  // 로그인된 사용자의 Firestore 실시간 구독
  useEffect(() => {
    if (!authReady || !user) {
      if (!guestMode) {
        setJobs([]);
        setShifts([]);
        setSettings(DEFAULT_SETTINGS);
        setSalarySimulations([]);
        setAccountEntries([]);
        setFilterJobId('');
      }
      return;
    }

    let cancelled = false;
    const unsubs: (() => void)[] = [];

    // 계정 전환 시 이전 계정 데이터가 남지 않도록 초기화
    setJobs([]);
    setShifts([]);
    setSettings(DEFAULT_SETTINGS);
    setSalarySimulations([]);
    setAccountEntries([]);
    setFilterJobId('');
    setCloudLoading(true);
    setCloudError(null);

    const localData = readLocalStorageState();
    const dismissedForUid = localStorage.getItem(LOCAL_MIGRATION_DISMISSED_KEY);
    if (
      localData &&
      (localData.shifts.length > 0 || (localData.accountEntries?.length ?? 0) > 0) &&
      dismissedForUid !== user.uid
    ) {
      setPendingLocalImport(localData);
    } else {
      setPendingLocalImport(null);
    }

    const startSync = async () => {
      try {
        await ensureUserInitialized(user);
        if (cancelled) return;

        let loadedFlags = {
          prefs: false,
          jobs: false,
          shifts: false,
          entries: false,
          sims: false,
        };
        const markLoaded = (key: keyof typeof loadedFlags) => {
          loadedFlags[key] = true;
          if (
            loadedFlags.prefs &&
            loadedFlags.jobs &&
            loadedFlags.shifts &&
            loadedFlags.entries &&
            loadedFlags.sims
          ) {
            setCloudLoading(false);
          }
        };

        const handleSyncError = (err: unknown) => {
          const msg =
            err instanceof Error ? err.message : '클라우드 데이터를 불러오는 중 오류가 발생했습니다.';
          setCloudError(msg);
          setCloudLoading(false);
        };

        unsubs.push(
          subscribeUserPreferences(
            user.uid,
            (next) => {
              setSettings(next);
              markLoaded('prefs');
            },
            handleSyncError
          )
        );
        unsubs.push(
          subscribeUserJobs(
            user.uid,
            (next) => {
              setJobs(next);
              markLoaded('jobs');
            },
            handleSyncError
          )
        );
        unsubs.push(
          subscribeUserShifts(
            user.uid,
            (next) => {
              setShifts(next);
              markLoaded('shifts');
            },
            handleSyncError
          )
        );
        unsubs.push(
          subscribeUserAccountEntries(
            user.uid,
            (next) => {
              setAccountEntries(next);
              markLoaded('entries');
            },
            handleSyncError
          )
        );
        unsubs.push(
          subscribeUserSalarySimulations(
            user.uid,
            (next) => {
              setSalarySimulations(next);
              markLoaded('sims');
            },
            handleSyncError
          )
        );
      } catch (err) {
        if (!cancelled) {
          setCloudError(
            err instanceof Error
              ? err.message
              : '개인 계정 데이터베이스 초기화에 실패했습니다.'
          );
          setCloudLoading(false);
        }
      }
    };

    void startSync();

    return () => {
      cancelled = true;
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [authReady, user, guestMode]);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogleSmart();
    } catch (error) {
      console.error('[Firebase Popup Auth Error]', error);
      setAuthError(formatAuthErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleRedirectSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogleRedirect();
    } catch (error) {
      console.error('[Firebase Redirect Trigger Error]', error);
      setAuthError(formatAuthErrorMessage(error));
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setGuestMode(false);
      setPendingLocalImport(null);
      showToast('계정에서 로그아웃했습니다.');
    } catch {
      showToast('로그아웃 처리 중 오류가 발생했습니다.');
    }
  };

  const handleImportLocalToAccount = async () => {
    if (!user || !pendingLocalImport) return;
    setImportingLocal(true);
    try {
      await importBackupToFirestore(user.uid, pendingLocalImport, shifts.length === 0);
      localStorage.setItem(LOCAL_MIGRATION_DISMISSED_KEY, user.uid);
      setPendingLocalImport(null);
      showToast('로컬 기록을 내 Google 계정으로 가져왔습니다.');
    } catch {
      showToast('로컬 기록을 가져오는 중 오류가 발생했습니다.');
    } finally {
      setImportingLocal(false);
    }
  };

  const handleDismissLocalImport = () => {
    if (user) {
      localStorage.setItem(LOCAL_MIGRATION_DISMISSED_KEY, user.uid);
    }
    setPendingLocalImport(null);
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

  const updatePreferences = async (next: AppSettings, toastMsg?: string) => {
    if (user) {
      try {
        await saveUserPreferences(user.uid, next);
        if (toastMsg) showToast(toastMsg);
      } catch {
        showToast('설정 저장 중 오류가 발생했습니다.');
      }
      return;
    }
    setSettings(next);
    if (toastMsg) showToast(toastMsg);
  };

  const handleSaveShift = async (
    shiftData: Omit<WorkShift, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (user) {
      try {
        await upsertShift(user.uid, shiftData, existingId);
        if (!existingId) {
          setMonthKey(shiftData.date.slice(0, 7));
          setSelectedDate(shiftData.date);
        }
        showToast(existingId ? '근무 기록을 수정했습니다.' : '새 근무를 기록했습니다.');
        setModalOpen(false);
        setModalEditingShift(null);
      } catch {
        showToast('근무 기록 저장 중 오류가 발생했습니다.');
      }
      return;
    }

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

  const handleDeleteShift = async (id: string) => {
    if (user) {
      try {
        await removeShift(user.uid, id);
        showToast('근무 기록을 삭제했습니다.');
      } catch {
        showToast('근무 기록 삭제 중 오류가 발생했습니다.');
      }
      return;
    }
    setShifts((prev) => prev.filter((s) => s.id !== id));
    showToast('근무 기록을 삭제했습니다.');
  };

  const handleTogglePaymentStatus = async (id: string) => {
    const target = shifts.find((s) => s.id === id);
    if (!target) return;
    if (user) {
      try {
        await toggleShiftPaymentStatus(user.uid, target);
      } catch {
        showToast('정산 상태 변경 중 오류가 발생했습니다.');
      }
      return;
    }
    setShifts((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, paymentStatus: s.paymentStatus === 'settled' ? 'pending' : 'settled' }
          : s
      )
    );
  };

  const handleBulkSettleMonth = async (targetMonthKey: string, jobId?: string) => {
    if (user) {
      const targetIds = shifts
        .filter(
          (s) =>
            s.date.startsWith(targetMonthKey) &&
            s.paymentStatus !== 'settled' &&
            (!jobId || s.jobId === jobId)
        )
        .map((s) => s.id);
      if (targetIds.length === 0) {
        showToast('이미 모든 근무가 정산 완료 상태입니다.');
        return;
      }
      try {
        await bulkSettleShifts(user.uid, targetIds);
        showToast('미정산 근무를 일괄 정산 완료 처리했습니다.');
      } catch {
        showToast('일괄 정산 처리 중 오류가 발생했습니다.');
      }
      return;
    }
    setShifts((prev) =>
      prev.map((s) => {
        if (!s.date.startsWith(targetMonthKey)) return s;
        if (jobId && s.jobId !== jobId) return s;
        return { ...s, paymentStatus: 'settled' };
      })
    );
    showToast('미정산 근무를 일괄 정산 완료 처리했습니다.');
  };

  const handleBulkSettleByGroup = async (targetMonthKey: string, groupName: string) => {
    const groupJobIds = new Set(
      jobs
        .filter((j) => (j.majorCategory || j.groupName || '주간') === groupName)
        .map((j) => j.id)
    );
    if (user) {
      const targetIds = shifts
        .filter(
          (s) =>
            s.date.startsWith(targetMonthKey) &&
            s.paymentStatus !== 'settled' &&
            groupJobIds.has(s.jobId)
        )
        .map((s) => s.id);
      if (targetIds.length === 0) {
        showToast(`${groupName} 대분류에 미정산 근무가 없습니다.`);
        return;
      }
      try {
        await bulkSettleShifts(user.uid, targetIds);
        showToast(`${groupName} 대분류의 미정산 근무를 일괄 정산 완료했습니다.`);
      } catch {
        showToast('일괄 정산 처리 중 오류가 발생했습니다.');
      }
      return;
    }
    setShifts((prev) =>
      prev.map((s) => {
        if (!s.date.startsWith(targetMonthKey)) return s;
        if (!groupJobIds.has(s.jobId)) return s;
        return { ...s, paymentStatus: 'settled' };
      })
    );
    showToast(`${groupName} 대분류의 미정산 근무를 일괄 정산 완료했습니다.`);
  };

  const handleQuickAddJobShift = async (dateStr: string, job: JobProfile) => {
    const newShiftData: Omit<WorkShift, 'id' | 'createdAt'> = {
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
    };

    if (user) {
      try {
        await upsertShift(user.uid, newShiftData);
        showToast(`${job.name} 근무를 빠르게 기록했습니다.`);
      } catch {
        showToast('빠른 근무 기록 저장 중 오류가 발생했습니다.');
      }
      return;
    }

    const newShift: WorkShift = {
      ...newShiftData,
      id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

    if (user) {
      const batchItems: Omit<WorkShift, 'id' | 'createdAt'>[] = toCopy.map((s) => {
        const { id: _id, createdAt: _createdAt, ...rest } = s;
        return {
          ...rest,
          date: targetDateStr,
          paymentStatus: 'pending',
        };
      });
      void createManyShifts(user.uid, batchItems)
        .then(() => showToast('이전 근무 내역을 복사했습니다.'))
        .catch(() => showToast('이전 근무 복사 중 오류가 발생했습니다.'));
      return true;
    }

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

  const handleSaveJob = async (jobData: Omit<JobProfile, 'id'>, existingId?: string) => {
    if (user) {
      try {
        await upsertJob(user.uid, jobData, existingId);
        showToast(existingId ? '직장 정보를 수정했습니다.' : '새 직장을 추가했습니다.');
      } catch {
        showToast('직장 정보 저장 중 오류가 발생했습니다.');
      }
      return;
    }
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

  const handleToggleArchiveJob = async (id: string) => {
    const target = jobs.find((j) => j.id === id);
    if (!target) return;
    if (user) {
      try {
        await toggleJobArchived(user.uid, target);
      } catch {
        showToast('근무처 보관 상태 변경 중 오류가 발생했습니다.');
      }
      return;
    }
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, archived: !j.archived } : j))
    );
  };

  const handleExportBackupJSON = () => {
    const payload: StoredState = {
      jobs,
      shifts,
      settings,
      salarySimulations,
      accountEntries,
    };
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
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<StoredState>;
        if (!Array.isArray(parsed.jobs) || !Array.isArray(parsed.shifts)) {
          showToast('올바른 일당노트 백업 파일이 아닙니다.');
          return;
        }
        const normalizedPayload: StoredState = {
          jobs: normalizeJobs(parsed.jobs),
          shifts: parsed.shifts,
          settings: parsed.settings ? { ...DEFAULT_SETTINGS, ...parsed.settings } : settings,
          salarySimulations: Array.isArray(parsed.salarySimulations)
            ? parsed.salarySimulations
            : [],
          accountEntries: Array.isArray(parsed.accountEntries) ? parsed.accountEntries : [],
        };

        if (user) {
          await importBackupToFirestore(user.uid, normalizedPayload, true);
          showToast('백업 데이터를 개인 계정에 불러왔습니다.');
          return;
        }

        setJobs(normalizedPayload.jobs);
        setShifts(normalizedPayload.shifts);
        setSettings(normalizedPayload.settings);
        setSalarySimulations(normalizedPayload.salarySimulations || []);
        setAccountEntries(normalizedPayload.accountEntries || []);
        showToast('백업 데이터를 불러왔습니다.');
      } catch {
        showToast('JSON 파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveSalarySimulation = async (
    sim: Omit<SalarySimulation, 'id' | 'createdAt'>
  ) => {
    if (user) {
      try {
        await createSalarySimulation(user.uid, sim);
        showToast('연봉 비교 목록에 저장했습니다.');
      } catch {
        showToast('연봉 비교 저장 중 오류가 발생했습니다.');
      }
      return;
    }
    const newSim: SalarySimulation = {
      ...sim,
      id: `salary-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      createdAt: new Date().toISOString(),
    };
    setSalarySimulations((prev) => [newSim, ...prev]);
    showToast('연봉 비교 목록에 저장했습니다.');
  };

  const handleDeleteSalarySimulation = async (id: string) => {
    if (user) {
      try {
        await removeSalarySimulation(user.uid, id);
        showToast('연봉 비교 항목을 삭제했습니다.');
      } catch {
        showToast('연봉 비교 항목 삭제 중 오류가 발생했습니다.');
      }
      return;
    }
    setSalarySimulations((prev) => prev.filter((s) => s.id !== id));
    showToast('연봉 비교 항목을 삭제했습니다.');
  };

  const handleSaveAccountEntry = async (
    data: Omit<AccountBookEntry, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (user) {
      try {
        await upsertAccountEntry(user.uid, data, existingId);
        showToast(existingId ? '가계부 내역을 수정했습니다.' : '가계부에 기록했습니다.');
      } catch {
        showToast('가계부 저장 중 오류가 발생했습니다.');
      }
      return;
    }
    if (existingId) {
      setAccountEntries((prev) =>
        prev.map((e) => (e.id === existingId ? { ...e, ...data } : e))
      );
      showToast('가계부 내역을 수정했습니다.');
    } else {
      const newEntry: AccountBookEntry = {
        ...data,
        id: `acct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setAccountEntries((prev) => [newEntry, ...prev]);
      showToast('가계부에 기록했습니다.');
    }
  };

  const handleDeleteAccountEntry = async (id: string) => {
    if (user) {
      try {
        await removeAccountEntry(user.uid, id);
        showToast('가계부 내역을 삭제했습니다.');
      } catch {
        showToast('가계부 내역 삭제 중 오류가 발생했습니다.');
      }
      return;
    }
    setAccountEntries((prev) => prev.filter((e) => e.id !== id));
    showToast('가계부 내역을 삭제했습니다.');
  };

  const handleCopyPreviousFixed = (targetMonthKey: string): number => {
    const prevKey = getAdjacentMonthKey(targetMonthKey, -1);
    const prevFixed = accountEntries.filter(
      (e) => e.date.startsWith(prevKey) && e.type === 'fixed'
    );
    if (prevFixed.length === 0) return 0;
    const [y, m] = targetMonthKey.split('-').map(Number);
    const maxDay = new Date(y, m, 0).getDate();

    if (user) {
      const batchItems: Omit<AccountBookEntry, 'id' | 'createdAt'>[] = prevFixed.map((item) => {
        const origDay = Math.min(Number(item.date.slice(8, 10)) || 1, maxDay);
        const { id: _id, createdAt: _createdAt, ...rest } = item;
        return {
          ...rest,
          date: `${targetMonthKey}-${String(origDay).padStart(2, '0')}`,
        };
      });
      void createManyAccountEntries(user.uid, batchItems)
        .then(() => showToast(`전월 고정비 ${batchItems.length}건을 불러왔습니다.`))
        .catch(() => showToast('고정비 불러오기 중 오류가 발생했습니다.'));
      return batchItems.length;
    }

    const copied: AccountBookEntry[] = prevFixed.map((item, idx) => {
      const origDay = Math.min(Number(item.date.slice(8, 10)) || 1, maxDay);
      return {
        ...item,
        id: `acct-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        date: `${targetMonthKey}-${String(origDay).padStart(2, '0')}`,
        createdAt: new Date().toISOString(),
      };
    });
    setAccountEntries((prev) => [...copied, ...prev]);
    return copied.length;
  };

  const handleConfirmReset = async () => {
    const mode = confirmResetMode;
    setConfirmResetMode('none');
    if (user) {
      try {
        if (mode === 'clear') {
          await clearUserRecords(user.uid);
          showToast('근무 및 가계부 기록을 비웠습니다.');
        } else {
          await seedSampleUserData(user.uid, monthKey);
          showToast('샘플 투잡 · 가계부 데이터를 복원했습니다.');
        }
      } catch {
        showToast('데이터 초기화 중 오류가 발생했습니다.');
      }
      return;
    }
    if (mode === 'clear') {
      setShifts([]);
      setAccountEntries([]);
      showToast('근무 및 가계부 기록을 비웠습니다.');
    } else {
      setJobs(DEFAULT_JOBS);
      setShifts(createSampleShiftsForMonth(monthKey));
      setAccountEntries(createSampleAccountEntriesForMonth(monthKey));
      showToast('샘플 투잡 · 가계부 데이터를 복원했습니다.');
    }
  };

  const navItems: { id: ActiveTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { id: 'calendar', label: '월간 캘린더', shortLabel: '캘린더', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'ledger', label: '근무 내역표', shortLabel: '내역표', icon: <Table2 className="w-4 h-4" /> },
    { id: 'gongsu', label: '공수·정산 관리', shortLabel: '공수', icon: <Calculator className="w-4 h-4" /> },
    { id: 'jobs', label: '근무처 관리', shortLabel: '근무처', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'analytics', label: '월별 취합·비교', shortLabel: '취합', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'salary', label: '연봉 계산기', shortLabel: '연봉', icon: <Wallet className="w-4 h-4" /> },
    { id: 'accountbook', label: '가계부', shortLabel: '가계부', icon: <ReceiptText className="w-4 h-4" /> },
  ];

  const activeTabTitle = navItems.find((n) => n.id === activeTab)?.label || '월간 캘린더';

  // 1. 인증 초기화 대기 화면
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-5 text-sm text-slate-600 font-medium">
          개인 계정 세션을 확인하는 중...
        </div>
      </div>
    );
  }

  // 2. 비로그인 & 게스트 모드 미선택 시 개인 계정 로그인 화면
  if (!user && !guestMode) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700">
              <ShieldCheck className="w-4 h-4" />
              <span>개인별 클라우드 계정 동기화</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">일당노트</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              일용직·투잡 근무 기록, 공수·주휴수당 계산, 연봉 시뮬레이션과 가계부를 개인 Google 계정별로 안전하게 분리 보관합니다.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs text-slate-700">
            <div className="flex items-start gap-2.5">
              <Cloud className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>계정마다 근무처·근무내역·가계부가 독립 저장되어 가족이나 동료와 기기를 공유해도 섞이지 않습니다.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <CalendarDays className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>PC와 스마트폰에서 같은 Google 계정으로 로그인하면 월별 수입과 정산 내역이 실시간 동기화됩니다.</span>
            </div>
          </div>

          {authError && (
            <div
              role="alert"
              className="px-3.5 py-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg space-y-2.5"
            >
              <p className="leading-relaxed">{authError}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGoogleRedirectSignIn}
                  disabled={authLoading}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-rose-800 bg-white border border-rose-200 hover:bg-rose-100 rounded-md whitespace-nowrap"
                >
                  리다이렉트 방식으로 로그인
                </button>
                {typeof window !== 'undefined' && window.self !== window.top && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md whitespace-nowrap"
                  >
                    새 탭에서 열어 로그인
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" />
              <span>{authLoading ? 'Google 로그인 연결 중...' : 'Google 계정으로 로그인'}</span>
            </button>

            <button
              type="button"
              onClick={() => setGuestMode(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
            >
              <span>로그인 없이 이 기기에서만 체험하기 (로컬 저장)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || '개인 계정';
  const displayEmail = user?.email || '로컬 체험 모드 (브라우저 저장)';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* 데스크톱 좌측 사이드바 */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-20">
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200">
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            일당노트
          </span>
          <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
            {user ? '클라우드' : '로컬'}
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="주요 메뉴">
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

        {/* 하단 개인 계정 카드 + 환경설정 및 데이터 백업 */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          {/* 계정 정보 */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full border border-slate-200 object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <UserCircle2 className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">{displayName}</p>
                <p className="text-[11px] text-slate-500 truncate">{displayEmail}</p>
              </div>
            </div>

            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 whitespace-nowrap"
              >
                <LogOut className="w-3 h-3" />
                <span>로그아웃 · 계정 전환</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 whitespace-nowrap"
              >
                <LogIn className="w-3 h-3" />
                <span>{authLoading ? '로그인 중...' : 'Google 계정 연동'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>달력 시작 요일</span>
            <button
              type="button"
              onClick={() =>
                void updatePreferences({
                  ...settings,
                  weekStartsOnMonday: !settings.weekStartsOnMonday,
                })
              }
              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded whitespace-nowrap"
            >
              {settings.weekStartsOnMonday ? '월요일 시작' : '일요일 시작'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleExportBackupJSON}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3 h-3" />
              백업 저장
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
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
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                샘플 복원
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetMode('clear')}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-700 whitespace-nowrap"
              >
                <Trash2 className="w-3 h-3" />
                기록 비우기
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
              <p className="text-[11px] text-slate-700 leading-snug">
                {confirmResetMode === 'clear'
                  ? '근무 및 가계부 기록을 모두 비울까요? (직장 설정은 유지)'
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
                  onClick={() => void handleConfirmReset()}
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
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-10">
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
            {/* 모바일 / 태블릿용 계정 상태 버튼 */}
            <div className="lg:hidden">
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0"
                  title={`${displayName} 로그아웃`}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle2 className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline max-w-[90px] truncate">{displayName}</span>
                  <LogOut className="w-3.5 h-3.5 text-slate-500" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>로그인</span>
                </button>
              )}
            </div>

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
          {/* 클라우드 오류 알림 */}
          {cloudError && (
            <div
              role="alert"
              className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-800 flex items-center justify-between gap-3"
            >
              <span>개인 계정 동기화 중 문제가 발생했습니다. 잠시 후 새로고침해 주세요.</span>
              <button
                type="button"
                onClick={() => setCloudError(null)}
                className="text-rose-700 font-semibold whitespace-nowrap"
              >
                닫기
              </button>
            </div>
          )}

          {/* 로컬(게스트) 기록 가져오기 안내 */}
          {user && pendingLocalImport && !cloudLoading && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-800">
                <span className="font-semibold text-blue-900">이 브라우저의 로컬 기록 발견</span>
                <span className="ml-2 text-slate-600 font-mono-num">
                  근무 {pendingLocalImport.shifts.length}건 · 가계부{' '}
                  {pendingLocalImport.accountEntries?.length ?? 0}건 · 근무처{' '}
                  {pendingLocalImport.jobs.length}곳
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleImportLocalToAccount}
                  disabled={importingLocal}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg whitespace-nowrap"
                >
                  {importingLocal ? '가져오는 중...' : '내 계정으로 가져오기'}
                </button>
                <button
                  type="button"
                  onClick={handleDismissLocalImport}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
                >
                  건너뛰기
                </button>
              </div>
            </div>
          )}

          {/* 첫 클라우드 로딩 상태 */}
          {user && cloudLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse"
                  />
                ))}
              </div>
              <div className="h-96 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-sm text-slate-500">
                {displayName}님의 개인 근무 · 가계부 데이터를 불러오는 중...
              </div>
            </div>
          ) : (
            <>
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
                  onUpdateMonthlyGoal={(goal) =>
                    void updatePreferences(
                      { ...settings, monthlyGoalNetPay: goal },
                      '월 목표 실수령액을 저장했습니다.'
                    )
                  }
                  onSelectMonth={handleSelectMonth}
                />
              )}

              {activeTab === 'salary' && (
                <AnnualSalaryCalculatorView
                  currentMonthSideNetPay={monthlySummary.netPay}
                  simulations={salarySimulations}
                  onSaveSimulation={handleSaveSalarySimulation}
                  onDeleteSimulation={handleDeleteSalarySimulation}
                />
              )}

              {activeTab === 'accountbook' && (
                <AccountBookView
                  monthKey={monthKey}
                  selectedDate={selectedDate}
                  jobs={jobs}
                  shifts={shifts}
                  monthlySummary={monthlySummary}
                  entries={accountEntries}
                  monthlyBudgetLimit={settings.monthlyBudgetLimit ?? 1200000}
                  onUpdateBudgetLimit={(limit) =>
                    void updatePreferences(
                      { ...settings, monthlyBudgetLimit: limit },
                      '월 지출 예산을 저장했습니다.'
                    )
                  }
                  onSaveEntry={handleSaveAccountEntry}
                  onDeleteEntry={handleDeleteAccountEntry}
                  onCopyPreviousFixed={handleCopyPreviousFixed}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* 모바일 하단 네비게이션 */}
      <nav
        aria-label="모바일 메뉴"
        className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-white border-t border-slate-200 grid grid-cols-7 z-20"
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
