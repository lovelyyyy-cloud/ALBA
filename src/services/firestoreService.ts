import { User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_JOBS,
  DEFAULT_SETTINGS,
  createSampleAccountEntriesForMonth,
  createSampleShiftsForMonth,
} from '../data/sampleData';
import { OperationType, db, handleFirestoreError } from '../firebase';
import {
  AccountBookEntry,
  AccountEntryType,
  AppSettings,
  EmploymentType,
  JobColorKey,
  JobMajorCategory,
  JobProfile,
  PayCycle,
  PayType,
  PaymentMethod,
  PaymentStatus,
  SalarySimulation,
  ShiftInputMode,
  TaxType,
  WorkShift,
} from '../types/work';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const TIME_REGEX = /^[0-2][0-9]:[0-5][0-9]$/;

const MAJOR_CATEGORIES: JobMajorCategory[] = ['주간', '야간', '주말(주간)', '주말(야간)'];
const JOB_COLORS: JobColorKey[] = ['blue', 'emerald', 'amber', 'violet', 'rose', 'cyan'];
const PAY_TYPES: PayType[] = ['daily', 'hourly', 'piece'];
const INPUT_MODES: ShiftInputMode[] = ['min_wage', 'custom_hourly', 'daily_incentive'];
const TAX_TYPES: TaxType[] = ['daily_tax', 'freelance_3_3', 'four_insurance', 'none', 'custom'];
const PAY_CYCLES: PayCycle[] = ['same_day', 'weekly', 'monthly'];
const PAYMENT_STATUSES: PaymentStatus[] = ['settled', 'pending'];
const ACCOUNT_TYPES: AccountEntryType[] = ['expense', 'fixed', 'saving', 'income'];
const PAYMENT_METHODS: PaymentMethod[] = ['카드', '현금·체크', '계좌이체'];
const EMPLOYMENT_TYPES: EmploymentType[] = ['정규직', '계약직'];

export function createDocId(prefix: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'doc';
  return `${safePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.slice(0, 128);
}

function sanitizeId(raw: string | undefined, fallbackPrefix: string): string {
  const candidate = (raw || '').trim();
  if (candidate.length >= 1 && candidate.length <= 128 && VALID_ID_REGEX.test(candidate)) {
    return candidate;
  }
  return createDocId(fallbackPrefix);
}

function clampString(value: unknown, maxLen: number, fallback = ''): string {
  const str = typeof value === 'string' ? value : value == null ? fallback : String(value);
  return str.trim().slice(0, maxLen);
}

function clampRequiredString(value: unknown, maxLen: number, fallback: string): string {
  const trimmed = clampString(value, maxLen, '');
  return trimmed.length >= 1 ? trimmed : fallback.slice(0, maxLen);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeDate(value: unknown, fallback: string): string {
  const str = typeof value === 'string' ? value.trim() : '';
  return DATE_REGEX.test(str) ? str : fallback;
}

function sanitizeTime(value: unknown, fallback: string): string {
  const str = typeof value === 'string' ? value.trim() : '';
  if (!TIME_REGEX.test(str)) return fallback;
  const hh = Number(str.slice(0, 2));
  return hh >= 0 && hh <= 23 ? str : fallback;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return new Date().toISOString();
}

function sanitizeJobPayload(
  uid: string,
  data: Omit<JobProfile, 'id'>,
  isUpdate: boolean
): Record<string, unknown> {
  const majorCategory = pickEnum(data.majorCategory, MAJOR_CATEGORIES, '주간');
  const payType = pickEnum(data.payType, PAY_TYPES, 'daily');
  const defaultInputMode = pickEnum(
    data.defaultInputMode,
    INPUT_MODES,
    payType === 'hourly' ? 'custom_hourly' : 'daily_incentive'
  );
  const taxType = pickEnum(data.taxType, TAX_TYPES, 'daily_tax');

  const payload: Record<string, unknown> = {
    ownerId: uid,
    name: clampRequiredString(data.name, 80, '근무처'),
    majorCategory,
    subCategory: clampRequiredString(data.subCategory, 40, '기타'),
    groupName: clampRequiredString(data.groupName || majorCategory, 40, majorCategory),
    roleLabel: clampString(data.roleLabel, 100, ''),
    color: pickEnum(data.color, JOB_COLORS, 'blue'),
    payType,
    defaultInputMode,
    defaultRate: clampNumber(data.defaultRate, 0, 50_000_000, 0),
    defaultStartTime: sanitizeTime(data.defaultStartTime, '09:00'),
    defaultEndTime: sanitizeTime(data.defaultEndTime, '18:00'),
    defaultBreakMinutes: clampNumber(data.defaultBreakMinutes, 0, 600, 60),
    taxType,
    payCycle: pickEnum(data.payCycle, PAY_CYCLES, 'monthly'),
    enableNightAllowance: Boolean(data.enableNightAllowance),
    enableOvertimeAllowance: Boolean(data.enableOvertimeAllowance),
    includeWeeklyHolidayPay: Boolean(data.includeWeeklyHolidayPay),
    archived: Boolean(data.archived),
    updatedAt: serverTimestamp(),
  };

  if (!isUpdate) {
    payload.createdAt = serverTimestamp();
  }

  const address = clampString(data.address, 200, '');
  if (address) {
    payload.address = address;
  } else if (isUpdate) {
    payload.address = deleteField();
  }

  if (taxType === 'custom' && data.customTaxRate !== undefined && Number.isFinite(Number(data.customTaxRate))) {
    payload.customTaxRate = clampNumber(data.customTaxRate, 0, 60, 0);
  } else if (isUpdate) {
    payload.customTaxRate = deleteField();
  }

  const payDayNote = clampString(data.payDayNote, 100, '');
  if (payDayNote) {
    payload.payDayNote = payDayNote;
  } else if (isUpdate) {
    payload.payDayNote = deleteField();
  }

  return payload;
}

function sanitizeShiftPayload(
  uid: string,
  data: Omit<WorkShift, 'id' | 'createdAt'>,
  isUpdate: boolean
): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  const inputMode = pickEnum(data.inputMode, INPUT_MODES, 'daily_incentive');

  const payload: Record<string, unknown> = {
    ownerId: uid,
    date: sanitizeDate(data.date, today),
    jobId: sanitizeId(data.jobId, 'job'),
    inputMode,
    startTime: sanitizeTime(data.startTime, '09:00'),
    endTime: sanitizeTime(data.endTime, '18:00'),
    breakMinutes: clampNumber(data.breakMinutes, 0, 600, 60),
    workUnits: clampNumber(data.workUnits, 0.1, 10, 1),
    extraAllowance: clampNumber(data.extraAllowance, 0, 50_000_000, 0),
    expenseDeduction: clampNumber(data.expenseDeduction, 0, 50_000_000, 0),
    paymentStatus: pickEnum(data.paymentStatus, PAYMENT_STATUSES, 'pending'),
    memo: clampString(data.memo, 300, ''),
    updatedAt: serverTimestamp(),
  };

  if (!isUpdate) {
    payload.createdAt = serverTimestamp();
  }

  if (
    data.hourlyRateOverride !== undefined &&
    data.hourlyRateOverride !== null &&
    Number.isFinite(Number(data.hourlyRateOverride))
  ) {
    payload.hourlyRateOverride = clampNumber(data.hourlyRateOverride, 0, 5_000_000, 0);
  } else if (isUpdate) {
    payload.hourlyRateOverride = deleteField();
  }

  if (
    data.manualBasePay !== undefined &&
    data.manualBasePay !== null &&
    Number.isFinite(Number(data.manualBasePay))
  ) {
    payload.manualBasePay = clampNumber(data.manualBasePay, 0, 50_000_000, 0);
  } else if (isUpdate) {
    payload.manualBasePay = deleteField();
  }

  return payload;
}

function sanitizeAccountEntryPayload(
  uid: string,
  data: Omit<AccountBookEntry, 'id' | 'createdAt'>,
  isUpdate: boolean
): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  const payload: Record<string, unknown> = {
    ownerId: uid,
    date: sanitizeDate(data.date, today),
    type: pickEnum(data.type, ACCOUNT_TYPES, 'expense'),
    category: clampRequiredString(data.category, 40, '기타'),
    title: clampRequiredString(data.title, 100, '내역'),
    amount: clampNumber(data.amount, 0, 500_000_000, 0),
    paymentMethod: pickEnum(data.paymentMethod, PAYMENT_METHODS, '카드'),
    memo: clampString(data.memo, 200, ''),
    updatedAt: serverTimestamp(),
  };
  if (!isUpdate) {
    payload.createdAt = serverTimestamp();
  }
  return payload;
}

function sanitizeSalarySimulationPayload(
  uid: string,
  data: Omit<SalarySimulation, 'id' | 'createdAt'>
): Record<string, unknown> {
  return {
    ownerId: uid,
    companyName: clampRequiredString(data.companyName, 80, '회사명 미입력'),
    employmentType: pickEnum(data.employmentType, EMPLOYMENT_TYPES, '정규직'),
    contractMonths: clampNumber(data.contractMonths, 1, 120, 12),
    annualSalary: clampNumber(data.annualSalary, 0, 5_000_000_000, 0),
    severanceIncluded: Boolean(data.severanceIncluded),
    nonTaxableMonthly: clampNumber(data.nonTaxableMonthly, 0, 50_000_000, 200_000),
    dependents: clampNumber(data.dependents, 1, 20, 1),
    childrenCount: clampNumber(data.childrenCount, 0, 20, 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function ensureUserInitialized(user: User): Promise<{ isNewAccount: boolean }> {
  const uid = user.uid;
  const profilePath = `users/${uid}/private/profile`;
  const prefsPath = `users/${uid}/settings/preferences`;
  const jobsPath = `users/${uid}/jobs`;

  const profileRef = doc(db, 'users', uid, 'private', 'profile');
  const prefsRef = doc(db, 'users', uid, 'settings', 'preferences');

  const fallbackName = user.email ? user.email.split('@')[0] : '사용자';
  const displayName = clampRequiredString(user.displayName || fallbackName, 100, '사용자');
  const email = clampRequiredString(user.email, 200, 'user@example.com');
  const photoURL = clampString(user.photoURL, 500, '');

  try {
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      const profileDoc: Record<string, unknown> = {
        ownerId: uid,
        displayName,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photoURL) {
        profileDoc.photoURL = photoURL;
      }
      await setDoc(profileRef, profileDoc);
    } else {
      const existing = profileSnap.data();
      const changed =
        existing.displayName !== displayName ||
        existing.email !== email ||
        (existing.photoURL || '') !== photoURL;
      if (changed) {
        await updateDoc(profileRef, {
          displayName,
          email,
          photoURL: photoURL ? photoURL : deleteField(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  let isNewAccount = false;
  try {
    const prefsSnap = await getDoc(prefsRef);
    if (!prefsSnap.exists()) {
      isNewAccount = true;
      await setDoc(prefsRef, {
        ownerId: uid,
        monthlyGoalNetPay: DEFAULT_SETTINGS.monthlyGoalNetPay,
        monthlyBudgetLimit: DEFAULT_SETTINGS.monthlyBudgetLimit ?? 1_200_000,
        weekStartsOnMonday: DEFAULT_SETTINGS.weekStartsOnMonday,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, prefsPath);
  }

  if (isNewAccount) {
    try {
      const existingJobs = await getDocs(
        query(collection(db, 'users', uid, 'jobs'), where('ownerId', '==', uid), limit(1))
      );
      if (existingJobs.empty) {
        const batch = writeBatch(db);
        for (const job of DEFAULT_JOBS) {
          const { id, ...rest } = job;
          const safeId = sanitizeId(id, 'job');
          batch.set(doc(db, 'users', uid, 'jobs', safeId), sanitizeJobPayload(uid, rest, false));
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, jobsPath);
    }
  }

  return { isNewAccount };
}

export function subscribeUserPreferences(
  uid: string,
  onData: (settings: AppSettings) => void,
  onError: (err: unknown) => void
): () => void {
  const path = `users/${uid}/settings/preferences`;
  const ref = doc(db, 'users', uid, 'settings', 'preferences');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SETTINGS);
        return;
      }
      const d = snap.data();
      onData({
        monthlyGoalNetPay: clampNumber(d.monthlyGoalNetPay, 0, 1_000_000_000, DEFAULT_SETTINGS.monthlyGoalNetPay),
        monthlyBudgetLimit: clampNumber(
          d.monthlyBudgetLimit,
          0,
          1_000_000_000,
          DEFAULT_SETTINGS.monthlyBudgetLimit ?? 1_200_000
        ),
        weekStartsOnMonday: Boolean(d.weekStartsOnMonday),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeUserJobs(
  uid: string,
  onData: (jobs: JobProfile[]) => void,
  onError: (err: unknown) => void
): () => void {
  const path = `users/${uid}/jobs`;
  const q = query(collection(db, 'users', uid, 'jobs'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: JobProfile[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const majorCategory = pickEnum(d.majorCategory, MAJOR_CATEGORIES, '주간');
        return {
          id: docSnap.id,
          name: String(d.name || '근무처'),
          majorCategory,
          subCategory: String(d.subCategory || '기타'),
          address: typeof d.address === 'string' ? d.address : undefined,
          groupName: String(d.groupName || majorCategory),
          roleLabel: String(d.roleLabel || ''),
          color: pickEnum(d.color, JOB_COLORS, 'blue'),
          payType: pickEnum(d.payType, PAY_TYPES, 'daily'),
          defaultInputMode: pickEnum(d.defaultInputMode, INPUT_MODES, 'daily_incentive'),
          defaultRate: Number(d.defaultRate || 0),
          defaultStartTime: String(d.defaultStartTime || '09:00'),
          defaultEndTime: String(d.defaultEndTime || '18:00'),
          defaultBreakMinutes: Number(d.defaultBreakMinutes ?? 60),
          taxType: pickEnum(d.taxType, TAX_TYPES, 'daily_tax'),
          customTaxRate: typeof d.customTaxRate === 'number' ? d.customTaxRate : undefined,
          payCycle: pickEnum(d.payCycle, PAY_CYCLES, 'monthly'),
          payDayNote: typeof d.payDayNote === 'string' ? d.payDayNote : undefined,
          enableNightAllowance: Boolean(d.enableNightAllowance),
          enableOvertimeAllowance: Boolean(d.enableOvertimeAllowance),
          includeWeeklyHolidayPay: Boolean(d.includeWeeklyHolidayPay),
          archived: Boolean(d.archived),
        };
      });
      items.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeUserShifts(
  uid: string,
  onData: (shifts: WorkShift[]) => void,
  onError: (err: unknown) => void
): () => void {
  const path = `users/${uid}/shifts`;
  const q = query(collection(db, 'users', uid, 'shifts'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: WorkShift[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          date: String(d.date || ''),
          jobId: String(d.jobId || ''),
          inputMode: pickEnum(d.inputMode, INPUT_MODES, 'daily_incentive'),
          hourlyRateOverride:
            typeof d.hourlyRateOverride === 'number' ? d.hourlyRateOverride : undefined,
          startTime: String(d.startTime || '09:00'),
          endTime: String(d.endTime || '18:00'),
          breakMinutes: Number(d.breakMinutes ?? 60),
          workUnits: Number(d.workUnits ?? 1),
          manualBasePay: typeof d.manualBasePay === 'number' ? d.manualBasePay : undefined,
          extraAllowance: Number(d.extraAllowance ?? 0),
          expenseDeduction: Number(d.expenseDeduction ?? 0),
          paymentStatus: pickEnum(d.paymentStatus, PAYMENT_STATUSES, 'pending'),
          memo: String(d.memo || ''),
          createdAt: timestampToIso(d.createdAt),
        };
      });
      items.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeUserAccountEntries(
  uid: string,
  onData: (entries: AccountBookEntry[]) => void,
  onError: (err: unknown) => void
): () => void {
  const path = `users/${uid}/accountEntries`;
  const q = query(collection(db, 'users', uid, 'accountEntries'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: AccountBookEntry[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          date: String(d.date || ''),
          type: pickEnum(d.type, ACCOUNT_TYPES, 'expense'),
          category: String(d.category || '기타'),
          title: String(d.title || ''),
          amount: Number(d.amount ?? 0),
          paymentMethod: pickEnum(d.paymentMethod, PAYMENT_METHODS, '카드'),
          memo: typeof d.memo === 'string' && d.memo.length > 0 ? d.memo : undefined,
          createdAt: timestampToIso(d.createdAt),
        };
      });
      items.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeUserSalarySimulations(
  uid: string,
  onData: (sims: SalarySimulation[]) => void,
  onError: (err: unknown) => void
): () => void {
  const path = `users/${uid}/salarySimulations`;
  const q = query(
    collection(db, 'users', uid, 'salarySimulations'),
    where('ownerId', '==', uid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SalarySimulation[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          companyName: String(d.companyName || ''),
          employmentType: pickEnum(d.employmentType, EMPLOYMENT_TYPES, '정규직'),
          contractMonths: Number(d.contractMonths ?? 12),
          annualSalary: Number(d.annualSalary ?? 0),
          severanceIncluded: Boolean(d.severanceIncluded),
          nonTaxableMonthly: Number(d.nonTaxableMonthly ?? 200_000),
          dependents: Number(d.dependents ?? 1),
          childrenCount: Number(d.childrenCount ?? 0),
          createdAt: timestampToIso(d.createdAt),
        };
      });
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export async function saveUserPreferences(uid: string, settings: AppSettings): Promise<void> {
  const path = `users/${uid}/settings/preferences`;
  const ref = doc(db, 'users', uid, 'settings', 'preferences');
  const nextGoal = clampNumber(settings.monthlyGoalNetPay, 0, 1_000_000_000, DEFAULT_SETTINGS.monthlyGoalNetPay);
  const nextBudget = clampNumber(
    settings.monthlyBudgetLimit ?? 1_200_000,
    0,
    1_000_000_000,
    1_200_000
  );
  const nextMonday = Boolean(settings.weekStartsOnMonday);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        monthlyGoalNetPay: nextGoal,
        monthlyBudgetLimit: nextBudget,
        weekStartsOnMonday: nextMonday,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: uid,
        monthlyGoalNetPay: nextGoal,
        monthlyBudgetLimit: nextBudget,
        weekStartsOnMonday: nextMonday,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertJob(
  uid: string,
  jobData: Omit<JobProfile, 'id'>,
  existingId?: string
): Promise<string> {
  const id = existingId ? sanitizeId(existingId, 'job') : createDocId('job');
  const path = `users/${uid}/jobs/${id}`;
  const ref = doc(db, 'users', uid, 'jobs', id);
  try {
    if (existingId) {
      await updateDoc(ref, sanitizeJobPayload(uid, jobData, true));
    } else {
      await setDoc(ref, sanitizeJobPayload(uid, jobData, false));
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function toggleJobArchived(uid: string, job: JobProfile): Promise<void> {
  const id = sanitizeId(job.id, 'job');
  const path = `users/${uid}/jobs/${id}`;
  const ref = doc(db, 'users', uid, 'jobs', id);
  try {
    await updateDoc(ref, {
      archived: !job.archived,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertShift(
  uid: string,
  shiftData: Omit<WorkShift, 'id' | 'createdAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId ? sanitizeId(existingId, 'shift') : createDocId('shift');
  const path = `users/${uid}/shifts/${id}`;
  const ref = doc(db, 'users', uid, 'shifts', id);
  try {
    if (existingId) {
      await updateDoc(ref, sanitizeShiftPayload(uid, shiftData, true));
    } else {
      await setDoc(ref, sanitizeShiftPayload(uid, shiftData, false));
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function createManyShifts(
  uid: string,
  items: Omit<WorkShift, 'id' | 'createdAt'>[]
): Promise<void> {
  if (items.length === 0) return;
  const path = `users/${uid}/shifts`;
  try {
    for (let i = 0; i < items.length; i += 400) {
      const chunk = items.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const id = createDocId('shift');
        batch.set(doc(db, 'users', uid, 'shifts', id), sanitizeShiftPayload(uid, item, false));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeShift(uid: string, shiftId: string): Promise<void> {
  const id = sanitizeId(shiftId, 'shift');
  const path = `users/${uid}/shifts/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'shifts', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleShiftPaymentStatus(
  uid: string,
  shift: WorkShift
): Promise<void> {
  const id = sanitizeId(shift.id, 'shift');
  const path = `users/${uid}/shifts/${id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'shifts', id), {
      paymentStatus: shift.paymentStatus === 'settled' ? 'pending' : 'settled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function bulkSettleShifts(uid: string, shiftIds: string[]): Promise<void> {
  if (shiftIds.length === 0) return;
  const path = `users/${uid}/shifts`;
  try {
    for (let i = 0; i < shiftIds.length; i += 400) {
      const chunk = shiftIds.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const rawId of chunk) {
        const id = sanitizeId(rawId, 'shift');
        batch.update(doc(db, 'users', uid, 'shifts', id), {
          paymentStatus: 'settled',
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertAccountEntry(
  uid: string,
  data: Omit<AccountBookEntry, 'id' | 'createdAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId ? sanitizeId(existingId, 'acct') : createDocId('acct');
  const path = `users/${uid}/accountEntries/${id}`;
  const ref = doc(db, 'users', uid, 'accountEntries', id);
  try {
    if (existingId) {
      await updateDoc(ref, sanitizeAccountEntryPayload(uid, data, true));
    } else {
      await setDoc(ref, sanitizeAccountEntryPayload(uid, data, false));
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function createManyAccountEntries(
  uid: string,
  items: Omit<AccountBookEntry, 'id' | 'createdAt'>[]
): Promise<void> {
  if (items.length === 0) return;
  const path = `users/${uid}/accountEntries`;
  try {
    for (let i = 0; i < items.length; i += 400) {
      const chunk = items.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const id = createDocId('acct');
        batch.set(
          doc(db, 'users', uid, 'accountEntries', id),
          sanitizeAccountEntryPayload(uid, item, false)
        );
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAccountEntry(uid: string, entryId: string): Promise<void> {
  const id = sanitizeId(entryId, 'acct');
  const path = `users/${uid}/accountEntries/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'accountEntries', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createSalarySimulation(
  uid: string,
  sim: Omit<SalarySimulation, 'id' | 'createdAt'>
): Promise<string> {
  const id = createDocId('salary');
  const path = `users/${uid}/salarySimulations/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'salarySimulations', id), sanitizeSalarySimulationPayload(uid, sim));
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeSalarySimulation(uid: string, simId: string): Promise<void> {
  const id = sanitizeId(simId, 'salary');
  const path = `users/${uid}/salarySimulations/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'salarySimulations', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

async function deleteCollectionDocs(uid: string, subcollection: string): Promise<void> {
  const path = `users/${uid}/${subcollection}`;
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, subcollection), where('ownerId', '==', uid))
    );
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      for (const d of docs.slice(i, i + 400)) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearUserRecords(uid: string): Promise<void> {
  await deleteCollectionDocs(uid, 'shifts');
  await deleteCollectionDocs(uid, 'accountEntries');
}

export async function seedSampleUserData(uid: string, monthKey: string): Promise<void> {
  await deleteCollectionDocs(uid, 'jobs');
  await deleteCollectionDocs(uid, 'shifts');
  await deleteCollectionDocs(uid, 'accountEntries');

  const sampleShifts = createSampleShiftsForMonth(monthKey);
  const sampleAccounts = createSampleAccountEntriesForMonth(monthKey);

  type WriteOp = { ref: ReturnType<typeof doc>; data: Record<string, unknown> };
  const ops: WriteOp[] = [];

  for (const job of DEFAULT_JOBS) {
    const { id, ...rest } = job;
    const safeId = sanitizeId(id, 'job');
    ops.push({
      ref: doc(db, 'users', uid, 'jobs', safeId),
      data: sanitizeJobPayload(uid, rest, false),
    });
  }
  for (const shift of sampleShifts) {
    const { id, createdAt: _ignored, ...rest } = shift;
    const safeId = sanitizeId(id, 'shift');
    ops.push({
      ref: doc(db, 'users', uid, 'shifts', safeId),
      data: sanitizeShiftPayload(uid, rest, false),
    });
  }
  for (const entry of sampleAccounts) {
    const { id, createdAt: _ignored, ...rest } = entry;
    const safeId = sanitizeId(id, 'acct');
    ops.push({
      ref: doc(db, 'users', uid, 'accountEntries', safeId),
      data: sanitizeAccountEntryPayload(uid, rest, false),
    });
  }

  const path = `users/${uid}`;
  try {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + 400)) {
        batch.set(op.ref, op.data);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface BackupImportPayload {
  jobs: JobProfile[];
  shifts: WorkShift[];
  settings?: AppSettings;
  salarySimulations?: SalarySimulation[];
  accountEntries?: AccountBookEntry[];
}

export async function importBackupToFirestore(
  uid: string,
  payload: BackupImportPayload,
  replaceExisting = true
): Promise<void> {
  let existingJobIds = new Set<string>();
  let existingShiftIds = new Set<string>();
  let existingEntryIds = new Set<string>();
  let existingSimIds = new Set<string>();

  if (replaceExisting) {
    await deleteCollectionDocs(uid, 'jobs');
    await deleteCollectionDocs(uid, 'shifts');
    await deleteCollectionDocs(uid, 'accountEntries');
    await deleteCollectionDocs(uid, 'salarySimulations');
  } else {
    try {
      const [jobsSnap, shiftsSnap, entriesSnap, simsSnap] = await Promise.all([
        getDocs(query(collection(db, 'users', uid, 'jobs'), where('ownerId', '==', uid))),
        getDocs(query(collection(db, 'users', uid, 'shifts'), where('ownerId', '==', uid))),
        getDocs(query(collection(db, 'users', uid, 'accountEntries'), where('ownerId', '==', uid))),
        getDocs(query(collection(db, 'users', uid, 'salarySimulations'), where('ownerId', '==', uid))),
      ]);
      existingJobIds = new Set(jobsSnap.docs.map((d) => d.id));
      existingShiftIds = new Set(shiftsSnap.docs.map((d) => d.id));
      existingEntryIds = new Set(entriesSnap.docs.map((d) => d.id));
      existingSimIds = new Set(simsSnap.docs.map((d) => d.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}`);
    }
  }

  if (payload.settings) {
    await saveUserPreferences(uid, payload.settings);
  }

  type WriteOp = { ref: ReturnType<typeof doc>; data: Record<string, unknown> };
  const ops: WriteOp[] = [];
  const jobIdMap = new Map<string, string>();

  for (const job of payload.jobs) {
    const { id, ...rest } = job;
    const safeId = sanitizeId(id, 'job');
    jobIdMap.set(id, safeId);
    if (!existingJobIds.has(safeId)) {
      ops.push({
        ref: doc(db, 'users', uid, 'jobs', safeId),
        data: sanitizeJobPayload(uid, rest, false),
      });
    }
  }

  for (const shift of payload.shifts) {
    const { id, createdAt: _ignored, ...rest } = shift;
    let safeId = sanitizeId(id, 'shift');
    if (existingShiftIds.has(safeId)) {
      safeId = createDocId('shift');
    }
    const mappedJobId = jobIdMap.get(rest.jobId) || sanitizeId(rest.jobId, 'job');
    ops.push({
      ref: doc(db, 'users', uid, 'shifts', safeId),
      data: sanitizeShiftPayload(uid, { ...rest, jobId: mappedJobId }, false),
    });
  }

  for (const entry of payload.accountEntries || []) {
    const { id, createdAt: _ignored, ...rest } = entry;
    let safeId = sanitizeId(id, 'acct');
    if (existingEntryIds.has(safeId)) {
      safeId = createDocId('acct');
    }
    ops.push({
      ref: doc(db, 'users', uid, 'accountEntries', safeId),
      data: sanitizeAccountEntryPayload(uid, rest, false),
    });
  }

  for (const sim of payload.salarySimulations || []) {
    const { id, createdAt: _ignored, ...rest } = sim;
    let safeId = sanitizeId(id, 'salary');
    if (existingSimIds.has(safeId)) {
      safeId = createDocId('salary');
    }
    ops.push({
      ref: doc(db, 'users', uid, 'salarySimulations', safeId),
      data: sanitizeSalarySimulationPayload(uid, rest),
    });
  }

  const path = `users/${uid}`;
  try {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + 400)) {
        batch.set(op.ref, op.data);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
