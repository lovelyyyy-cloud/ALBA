import React, { useMemo, useState } from 'react';
import { Copy, Download, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import {
  AccountBookEntry,
  AccountEntryType,
  JobProfile,
  MonthlySummary,
  PaymentMethod,
  WorkShift,
} from '../types/work';
import {
  calculateShift,
  formatKRW,
  formatKoreanDate,
  getAdjacentMonthKey,
} from '../utils/payroll';

interface AccountBookViewProps {
  monthKey: string;
  selectedDate: string;
  jobs: JobProfile[];
  shifts: WorkShift[];
  monthlySummary: MonthlySummary;
  entries: AccountBookEntry[];
  monthlyBudgetLimit: number;
  onUpdateBudgetLimit: (limit: number) => void;
  onSaveEntry: (data: Omit<AccountBookEntry, 'id' | 'createdAt'>, existingId?: string) => void;
  onDeleteEntry: (id: string) => void;
  onCopyPreviousFixed: (targetMonthKey: string) => number;
}

const CATEGORY_OPTIONS: Record<AccountEntryType, string[]> = {
  expense: ['식비', '카페·간식', '교통·주유', '생활·쇼핑', '의료·건강', '경조사·모임', '기타 지출'],
  fixed: ['월세·관리비', '통신·구독', '공과금·보험', '대출·할부', '기타 고정비'],
  saving: ['적금·예금', '비상금', '투자·주식', '기타 저축'],
  income: ['본업 월급', '중고거래', '지원금·환급', '용돈·기타수입'],
};

const ENTRY_TYPE_LABELS: Record<AccountEntryType, string> = {
  expense: '변동 지출',
  fixed: '고정비',
  saving: '저축·투자',
  income: '기타 수입',
};

const PAYMENT_METHODS: PaymentMethod[] = ['카드', '현금·체크', '계좌이체'];

export const AccountBookView: React.FC<AccountBookViewProps> = ({
  monthKey,
  selectedDate,
  jobs,
  shifts,
  monthlySummary,
  entries,
  monthlyBudgetLimit,
  onUpdateBudgetLimit,
  onSaveEntry,
  onDeleteEntry,
  onCopyPreviousFixed,
}) => {
  const [incomeBasis, setIncomeBasis] = useState<'all' | 'settled'>('all');
  const [includeWorkIncomeInTimeline, setIncludeWorkIncomeInTimeline] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | AccountEntryType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 입력 폼 상태
  const [editingEntry, setEditingEntry] = useState<AccountBookEntry | null>(null);
  const [date, setDate] = useState(selectedDate);
  const [type, setType] = useState<AccountEntryType>('expense');
  const [category, setCategory] = useState<string>('식비');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('카드');
  const [memo, setMemo] = useState('');

  const [budgetInput, setBudgetInput] = useState(String(monthlyBudgetLimit || 1200000));
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const monthEntries = useMemo(
    () => entries.filter((e) => e.date.startsWith(monthKey)),
    [entries, monthKey]
  );

  const monthShifts = useMemo(
    () => shifts.filter((s) => s.date.startsWith(monthKey)),
    [shifts, monthKey]
  );

  // 이번 달 가계부 핵심 집계
  const ledgerStats = useMemo(() => {
    const workIncome =
      incomeBasis === 'all' ? monthlySummary.netPay : monthlySummary.settledNetPay;

    let extraIncome = 0;
    let variableExpense = 0;
    let fixedExpense = 0;
    let savingTotal = 0;

    const categoryExpenseMap = new Map<string, number>();

    for (const e of monthEntries) {
      if (e.type === 'income') {
        extraIncome += e.amount;
      } else if (e.type === 'expense') {
        variableExpense += e.amount;
        categoryExpenseMap.set(
          e.category,
          (categoryExpenseMap.get(e.category) ?? 0) + e.amount
        );
      } else if (e.type === 'fixed') {
        fixedExpense += e.amount;
        categoryExpenseMap.set(
          e.category,
          (categoryExpenseMap.get(e.category) ?? 0) + e.amount
        );
      } else if (e.type === 'saving') {
        savingTotal += e.amount;
      }
    }

    const totalIncome = workIncome + extraIncome;
    const totalExpense = variableExpense + fixedExpense;
    const balanceAfterExpense = totalIncome - totalExpense;
    const remainingCash = totalIncome - totalExpense - savingTotal;
    const savingRate =
      totalIncome > 0 ? Math.round((savingTotal / totalIncome) * 1000) / 10 : 0;

    const categoryBreakdown = Array.from(categoryExpenseMap.entries())
      .map(([cat, sum]) => ({
        category: cat,
        amount: sum,
        ratio: totalExpense > 0 ? Math.round((sum / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      workIncome,
      extraIncome,
      totalIncome,
      variableExpense,
      fixedExpense,
      totalExpense,
      savingTotal,
      balanceAfterExpense,
      remainingCash,
      savingRate,
      categoryBreakdown,
    };
  }, [monthEntries, monthlySummary, incomeBasis]);

  const budgetRatio =
    monthlyBudgetLimit > 0
      ? Math.min(100, Math.round((ledgerStats.totalExpense / monthlyBudgetLimit) * 100))
      : 0;
  const budgetRemaining = monthlyBudgetLimit - ledgerStats.totalExpense;

  // 통합 내역 (가계부 항목 + 근무 수입 항목)
  const unifiedRows = useMemo(() => {
    type RowItem =
      | { kind: 'entry'; date: string; id: string; entry: AccountBookEntry }
      | {
          kind: 'work';
          date: string;
          id: string;
          jobName: string;
          netPay: number;
          settled: boolean;
          memo: string;
        };

    const q = searchQuery.trim().toLowerCase();
    const list: RowItem[] = [];

    for (const e of monthEntries) {
      if (typeFilter !== 'all' && e.type !== typeFilter) continue;
      if (q) {
        const text = `${e.date} ${e.category} ${e.title} ${e.memo || ''}`.toLowerCase();
        if (!text.includes(q)) continue;
      }
      list.push({ kind: 'entry', date: e.date, id: e.id, entry: e });
    }

    if (includeWorkIncomeInTimeline && (typeFilter === 'all' || typeFilter === 'income')) {
      for (const s of monthShifts) {
        if (incomeBasis === 'settled' && s.paymentStatus !== 'settled') continue;
        const job = jobMap.get(s.jobId);
        const calc = calculateShift(s, job);
        const jobName = job?.name || '근무 수입';
        if (q) {
          const text = `${s.date} ${jobName} ${s.memo}`.toLowerCase();
          if (!text.includes(q)) continue;
        }
        list.push({
          kind: 'work',
          date: s.date,
          id: `work-${s.id}`,
          jobName,
          netPay: calc.netPay,
          settled: s.paymentStatus === 'settled',
          memo: s.memo,
        });
      }
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [
    monthEntries,
    monthShifts,
    typeFilter,
    searchQuery,
    includeWorkIncomeInTimeline,
    incomeBasis,
    jobMap,
  ]);

  const handleTypeChange = (nextType: AccountEntryType) => {
    setType(nextType);
    setCategory(CATEGORY_OPTIONS[nextType][0]);
  };

  const resetForm = () => {
    setEditingEntry(null);
    setDate(selectedDate);
    setType('expense');
    setCategory(CATEGORY_OPTIONS.expense[0]);
    setTitle('');
    setAmount('');
    setPaymentMethod('카드');
    setMemo('');
  };

  const handleEditClick = (entry: AccountBookEntry) => {
    setEditingEntry(entry);
    setDate(entry.date);
    setType(entry.type);
    setCategory(entry.category);
    setTitle(entry.title);
    setAmount(String(entry.amount));
    setPaymentMethod(entry.paymentMethod);
    setMemo(entry.memo || '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Math.max(0, Number(amount) || 0);
    if (numericAmount <= 0) return;

    onSaveEntry(
      {
        date,
        type,
        category,
        title: title.trim() || category,
        amount: numericAmount,
        paymentMethod,
        memo: memo.trim(),
      },
      editingEntry?.id
    );
    resetForm();
  };

  const handleCopyFixed = () => {
    const count = onCopyPreviousFixed(monthKey);
    const prevLabel = getAdjacentMonthKey(monthKey, -1);
    setCopyFeedback(
      count > 0
        ? `${prevLabel} 고정비 ${count}건을 이번 달로 복사했습니다.`
        : `${prevLabel}에 복사할 고정비 기록이 없습니다.`
    );
    window.setTimeout(() => setCopyFeedback(null), 2600);
  };

  const handleExportCSV = () => {
    const header = ['날짜', '구분', '카테고리', '내용', '금액', '결제수단', '메모'];
    const lines = unifiedRows.map((row) => {
      if (row.kind === 'work') {
        return [
          row.date,
          '근무수입(연동)',
          row.settled ? '정산완료' : '정산대기',
          `"${row.jobName.replace(/"/g, '""')}"`,
          String(row.netPay),
          '계좌이체',
          `"${(row.memo || '').replace(/"/g, '""')}"`,
        ].join(',');
      }
      const e = row.entry;
      return [
        e.date,
        ENTRY_TYPE_LABELS[e.type],
        e.category,
        `"${e.title.replace(/"/g, '""')}"`,
        String(e.type === 'income' ? e.amount : -e.amount),
        e.paymentMethod,
        `"${(e.memo || '').replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csv = '\uFEFF' + [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `일당노트_가계부_${monthKey}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 상단 컨트롤 바: 근무 수입 기준 토글 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">근무 수입 연동 가계부</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            일당노트에 기록된 근무 실수령액이 자동 반영되어 지출·고정비·저축·남은 잔액을 관리합니다.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
          <button
            type="button"
            onClick={() => setIncomeBasis('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              incomeBasis === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            예상 실수령 전체 기준
          </button>
          <button
            type="button"
            onClick={() => setIncomeBasis('settled')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              incomeBasis === 'settled'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            정산완료 입금분만 기준
          </button>
        </div>
      </div>

      {/* 가계부 4칸 요약 바 */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-5 space-y-1.5">
            <span className="text-xs font-medium text-slate-500">총 가용 수입 (근무 + 기타)</span>
            <p className="text-2xl font-bold text-blue-700 font-mono-num">
              {formatKRW(ledgerStats.totalIncome)}
            </p>
            <p className="text-xs text-slate-500 font-mono-num">
              근무 {formatKRW(ledgerStats.workIncome)} · 기타 {formatKRW(ledgerStats.extraIncome)}
            </p>
          </div>

          <div className="p-5 space-y-1.5">
            <span className="text-xs font-medium text-slate-500">이번 달 총 지출</span>
            <p className="text-2xl font-bold text-rose-700 font-mono-num">
              -{formatKRW(ledgerStats.totalExpense)}
            </p>
            <p className="text-xs text-slate-500 font-mono-num">
              고정비 {formatKRW(ledgerStats.fixedExpense)} · 변동 {formatKRW(ledgerStats.variableExpense)}
            </p>
          </div>

          <div className="p-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">저축 · 투자액</span>
              <span className="text-xs font-semibold text-emerald-700 font-mono-num">
                저축률 {ledgerStats.savingRate}%
              </span>
            </div>
            <p className="text-2xl font-bold text-emerald-700 font-mono-num">
              {formatKRW(ledgerStats.savingTotal)}
            </p>
            <p className="text-xs text-slate-500 font-mono-num">
              지출 후 여력 {formatKRW(ledgerStats.balanceAfterExpense)}
            </p>
          </div>

          <div className="p-5 space-y-1.5">
            <span className="text-xs font-medium text-slate-500">남은 생활비 잔액</span>
            <p
              className={`text-2xl font-bold font-mono-num ${
                ledgerStats.remainingCash >= 0 ? 'text-slate-900' : 'text-rose-700'
              }`}
            >
              {formatKRW(ledgerStats.remainingCash)}
            </p>
            <p className="text-xs text-slate-500 font-mono-num">
              수입 - (지출 + 저축)
            </p>
          </div>
        </div>
      </section>

      {/* 중단: 지출/수입 입력 폼 (좌) + 카테고리 지출 비중 & 지출 예산 (우) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 좌측: 가계부 입력 폼 */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              {editingEntry ? '가계부 내역 수정' : '지출 · 고정비 · 저축 기록'}
            </h3>
            <button
              type="button"
              onClick={handleCopyFixed}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors"
            >
              <Copy className="w-3 h-3" />
              전월 고정비 불러오기
            </button>
          </div>

          {copyFeedback && (
            <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              {copyFeedback}
            </div>
          )}

          {/* 구분 선택 */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
            {(['expense', 'fixed', 'saving', 'income'] as AccountEntryType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  type === t
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ENTRY_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">날짜</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                {CATEGORY_OPTIONS[type].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">결제수단</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">내용</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`예: ${category} 내역`}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">금액 (원) *</label>
              <input
                type="number"
                min={1}
                step={500}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="예: 12000"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">메모 (선택)</label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="상세 메모"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {editingEntry && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
            )}
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              {editingEntry ? '내역 수정 저장' : '가계부에 추가'}
            </button>
          </div>
        </form>

        {/* 우측: 지출 예산 관리 + 카테고리별 지출 비중 */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          {/* 월 지출 예산 */}
          <div className="space-y-2.5 pb-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">이번 달 지출 예산 관리</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono-num">
                  사용 {formatKRW(ledgerStats.totalExpense)} / 예산 {formatKRW(monthlyBudgetLimit)}
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateBudgetLimit(Math.max(0, Number(budgetInput) || 0));
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-28 px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md font-mono-num text-right"
                  aria-label="월 지출 예산"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                >
                  설정
                </button>
              </form>
            </div>

            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  budgetRemaining < 0 ? 'bg-rose-600' : 'bg-blue-700'
                }`}
                style={{ width: `${budgetRatio}%` }}
              />
            </div>

            <div className="flex justify-between text-xs font-mono-num">
              <span className="text-slate-500">{budgetRatio}% 소진</span>
              <span className={budgetRemaining < 0 ? 'text-rose-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                {budgetRemaining < 0
                  ? `예산 초과 ${formatKRW(Math.abs(budgetRemaining))}`
                  : `남은 예산 ${formatKRW(budgetRemaining)}`}
              </span>
            </div>
          </div>

          {/* 카테고리별 지출 비중 */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">카테고리별 지출 현황</h3>
            {ledgerStats.categoryBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                이번 달 지출 기록이 아직 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {ledgerStats.categoryBreakdown.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">
                        {item.category}{' '}
                        <span className="text-slate-400 font-mono-num">({item.ratio}%)</span>
                      </span>
                      <span className="font-bold text-slate-900 font-mono-num">
                        {formatKRW(item.amount)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-700 rounded-full"
                        style={{ width: `${item.ratio}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단: 근무 수입 + 가계부 통합 내역 리스트 */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="내용, 카테고리, 직장명 검색..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'all', label: '전체' },
                  { id: 'expense', label: '변동지출' },
                  { id: 'fixed', label: '고정비' },
                  { id: 'saving', label: '저축' },
                  { id: 'income', label: '수입' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    typeFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={includeWorkIncomeInTimeline}
                onChange={(e) => setIncludeWorkIncomeInTimeline(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              근무 수입 함께 보기
            </label>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={unifiedRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            가계부 CSV
          </button>
        </div>

        {unifiedRows.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">
            표시할 가계부 내역이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">날짜</th>
                  <th className="py-2.5 px-3">구분 · 카테고리</th>
                  <th className="py-2.5 px-3">내용</th>
                  <th className="py-2.5 px-3">결제수단</th>
                  <th className="py-2.5 px-3 text-right">금액</th>
                  <th className="py-2.5 px-4 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unifiedRows.map((row) => {
                  if (row.kind === 'work') {
                    return (
                      <tr key={row.id} className="bg-blue-50/25 hover:bg-blue-50/40">
                        <td className="py-2.5 px-4 font-mono-num text-slate-700 whitespace-nowrap">
                          {formatKoreanDate(row.date)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-blue-700">근무수입</span>
                          <span className="text-slate-400 mx-1">·</span>
                          <span className="text-slate-600">
                            {row.settled ? '정산완료' : '정산대기'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {row.jobName}
                          {row.memo && (
                            <span className="text-slate-500 font-normal ml-1.5">
                              ({row.memo})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">급여 연동</td>
                        <td className="py-2.5 px-3 text-right font-bold font-mono-num text-blue-700 whitespace-nowrap">
                          +{formatKRW(row.netPay)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-[11px] text-slate-400">
                          자동 연동
                        </td>
                      </tr>
                    );
                  }

                  const e = row.entry;
                  const isIncome = e.type === 'income';
                  const isSaving = e.type === 'saving';
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono-num text-slate-700 whitespace-nowrap">
                        {formatKoreanDate(e.date)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            isIncome
                              ? 'text-blue-700'
                              : isSaving
                                ? 'text-emerald-700'
                                : 'text-slate-700'
                          }`}
                        >
                          {ENTRY_TYPE_LABELS[e.type]}
                        </span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="text-slate-600">{e.category}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-900 font-medium">
                        {e.title}
                        {e.memo && (
                          <span className="text-slate-500 font-normal ml-1.5">({e.memo})</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{e.paymentMethod}</td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold font-mono-num whitespace-nowrap ${
                          isIncome
                            ? 'text-blue-700'
                            : isSaving
                              ? 'text-emerald-700'
                              : 'text-rose-700'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatKRW(e.amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditClick(e)}
                            className="p-1 text-slate-400 hover:text-slate-900 rounded hover:bg-slate-100"
                            aria-label="수정"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteEntry(e.id)}
                            className="p-1 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50"
                            aria-label="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
