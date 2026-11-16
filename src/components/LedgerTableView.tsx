import React, { useMemo, useState } from 'react';
import { CheckCheck, Download, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { JobProfile, WorkShift } from '../types/work';
import {
  PAY_TYPE_LABELS,
  calculateShift,
  exportShiftsToCSV,
  formatHours,
  formatKRW,
  formatKoreanDate,
} from '../utils/payroll';

interface LedgerTableViewProps {
  monthKey: string;
  jobs: JobProfile[];
  shifts: WorkShift[];
  filterJobId: string;
  onChangeFilterJobId: (jobId: string) => void;
  onOpenNewShiftModal: () => void;
  onEditShift: (shift: WorkShift) => void;
  onDeleteShift: (id: string) => void;
  onTogglePaymentStatus: (id: string) => void;
  onBulkSettleMonth: (monthKey: string, jobId?: string) => void;
}

export const LedgerTableView: React.FC<LedgerTableViewProps> = ({
  monthKey,
  jobs,
  shifts,
  filterJobId,
  onChangeFilterJobId,
  onOpenNewShiftModal,
  onEditShift,
  onDeleteShift,
  onTogglePaymentStatus,
  onBulkSettleMonth,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'settled' | 'pending'>('all');

  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const activeJobs = useMemo(() => jobs.filter((j) => !j.archived), [jobs]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return shifts
      .filter((s) => {
        if (!s.date.startsWith(monthKey)) return false;
        if (filterJobId && s.jobId !== filterJobId) return false;
        if (statusFilter !== 'all' && s.paymentStatus !== statusFilter) return false;
        if (q) {
          const job = jobMap.get(s.jobId);
          const text = `${s.date} ${job?.name || ''} ${s.memo}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  }, [shifts, monthKey, filterJobId, statusFilter, searchQuery, jobMap]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, shift) => {
        const calc = calculateShift(shift, jobMap.get(shift.jobId));
        acc.hours += calc.workedHours;
        acc.gross += calc.grossPay;
        acc.tax += calc.taxAmount;
        acc.expenses += calc.expenseDeduction;
        acc.net += calc.netPay;
        if (shift.paymentStatus === 'pending') acc.pendingCount += 1;
        return acc;
      },
      { hours: 0, gross: 0, tax: 0, expenses: 0, net: 0, pendingCount: 0 }
    );
  }, [filteredRows, jobMap]);

  const handleDownloadCSV = () => {
    const csv = exportShiftsToCSV(monthKey, shifts, jobs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `일당노트_근무내역_${monthKey}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="직장명, 메모, 날짜 검색..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          <select
            value={filterJobId}
            onChange={(e) => onChangeFilterJobId(e.target.value)}
            aria-label="직장 필터"
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="">전체 직장</option>
            {activeJobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
            {(['all', 'settled', 'pending'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'all' ? '전체' : status === 'settled' ? '정산완료' : '정산대기'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {totals.pendingCount > 0 && (
            <button
              type="button"
              onClick={() => onBulkSettleMonth(monthKey, filterJobId || undefined)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              미정산 {totals.pendingCount}건 일괄 완료
            </button>
          )}
          <button
            type="button"
            onClick={handleDownloadCSV}
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            CSV 내보내기
          </button>
        </div>
      </div>

      {/* 데이터 그리드 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700">
              조건에 맞는 근무 기록이 없습니다.
            </p>
            <p className="text-xs text-slate-500">
              검색 조건을 변경하거나 새로운 일용직/투잡 근무를 추가해보세요.
            </p>
            <button
              type="button"
              onClick={onOpenNewShiftModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              첫 근무 기록하기
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">날짜</th>
                  <th className="py-2.5 px-3">직장 · 구분</th>
                  <th className="py-2.5 px-3">근무 시간</th>
                  <th className="py-2.5 px-3 text-right">실근무</th>
                  <th className="py-2.5 px-3 text-right">세전 수입</th>
                  <th className="py-2.5 px-3 text-right">세금 · 경비</th>
                  <th className="py-2.5 px-3 text-right">실수령액</th>
                  <th className="py-2.5 px-3">메모</th>
                  <th className="py-2.5 px-3 text-center">정산</th>
                  <th className="py-2.5 px-4 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRows.map((shift) => {
                  const job = jobMap.get(shift.jobId);
                  const calc = calculateShift(shift, job);

                  return (
                    <tr key={shift.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap font-mono-num">
                        {formatKoreanDate(shift.date)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 whitespace-nowrap">
                          {job?.name || '미지정 직장'}
                        </div>
                        <div className="text-[11px] text-slate-500 whitespace-nowrap">
                          {job ? PAY_TYPE_LABELS[job.payType] : '-'}
                          {job?.payType === 'daily' ? ` · ${shift.workUnits}공수` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap font-mono-num">
                        {shift.startTime}~{shift.endTime}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 whitespace-nowrap font-mono-num">
                        {formatHours(calc.workedHours)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 whitespace-nowrap font-mono-num">
                        {formatKRW(calc.grossPay)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-700 whitespace-nowrap font-mono-num">
                        -{formatKRW(calc.taxAmount + calc.expenseDeduction)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap font-mono-num">
                        {formatKRW(calc.netPay)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate" title={shift.memo}>
                        {shift.memo || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onTogglePaymentStatus(shift.id)}
                          className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
                            shift.paymentStatus === 'settled'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {shift.paymentStatus === 'settled' ? '정산완료' : '정산대기'}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditShift(shift)}
                            className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                            aria-label="수정"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteShift(shift.id)}
                            className="p-1 text-slate-500 hover:text-rose-700 rounded hover:bg-rose-50"
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
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-xs text-slate-900">
                  <td colSpan={3} className="py-3 px-4">
                    합계 ({filteredRows.length}건)
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num">
                    {formatHours(totals.hours)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num">
                    {formatKRW(totals.gross)}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-700 font-mono-num">
                    -{formatKRW(totals.tax + totals.expenses)}
                  </td>
                  <td className="py-3 px-3 text-right text-blue-700 font-bold font-mono-num">
                    {formatKRW(totals.net)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
