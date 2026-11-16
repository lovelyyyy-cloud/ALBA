import React, { useMemo, useState } from 'react';
import { BookmarkPlus, Trash2 } from 'lucide-react';
import { EmploymentType, SalarySimulation } from '../types/work';
import { calculateKoreanAnnualSalary, formatKRW } from '../utils/payroll';

interface AnnualSalaryCalculatorViewProps {
  currentMonthSideNetPay: number;
  simulations: SalarySimulation[];
  onSaveSimulation: (sim: Omit<SalarySimulation, 'id' | 'createdAt'>) => void;
  onDeleteSimulation: (id: string) => void;
}

const SALARY_PRESETS = [30000000, 36000000, 42000000, 50000000, 60000000];

export const AnnualSalaryCalculatorView: React.FC<AnnualSalaryCalculatorViewProps> = ({
  currentMonthSideNetPay,
  simulations,
  onSaveSimulation,
  onDeleteSimulation,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('정규직');
  const [contractMonths, setContractMonths] = useState<string>('12');
  const [annualSalary, setAnnualSalary] = useState<string>('40000000');
  const [severanceIncluded, setSeveranceIncluded] = useState(false);
  const [nonTaxableMonthly, setNonTaxableMonthly] = useState<string>('200000');
  const [dependents, setDependents] = useState<string>('1');
  const [childrenCount, setChildrenCount] = useState<string>('0');

  const breakdown = useMemo(
    () =>
      calculateKoreanAnnualSalary({
        annualSalary: Math.max(0, Number(annualSalary) || 0),
        employmentType,
        contractMonths: Math.max(1, Number(contractMonths) || 12),
        severanceIncluded,
        nonTaxableMonthly: Math.max(0, Number(nonTaxableMonthly) || 0),
        dependents: Math.max(1, Number(dependents) || 1),
        childrenCount: Math.max(0, Number(childrenCount) || 0),
      }),
    [
      annualSalary,
      employmentType,
      contractMonths,
      severanceIncluded,
      nonTaxableMonthly,
      dependents,
      childrenCount,
    ]
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSimulation({
      companyName: companyName.trim() || `${employmentType} 시뮬레이션`,
      employmentType,
      contractMonths: employmentType === '계약직' ? Math.max(1, Number(contractMonths) || 12) : 12,
      annualSalary: Math.max(0, Number(annualSalary) || 0),
      severanceIncluded,
      nonTaxableMonthly: Math.max(0, Number(nonTaxableMonthly) || 0),
      dependents: Math.max(1, Number(dependents) || 1),
      childrenCount: Math.max(0, Number(childrenCount) || 0),
    });
  };

  const handleLoadSimulation = (sim: SalarySimulation) => {
    setCompanyName(sim.companyName);
    setEmploymentType(sim.employmentType);
    setContractMonths(String(sim.contractMonths));
    setAnnualSalary(String(sim.annualSalary));
    setSeveranceIncluded(sim.severanceIncluded);
    setNonTaxableMonthly(String(sim.nonTaxableMonthly));
    setDependents(String(sim.dependents));
    setChildrenCount(String(sim.childrenCount));
  };

  const combinedMonthlyNet = breakdown.monthlyNet + currentMonthSideNetPay;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">연봉 계산기 (정규직 · 계약직)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            직장명과 고용형태(정규직/계약직), 연봉을 입력하면 4대보험·근로소득세를 제외한 월 예상 실수령액을 계산합니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 좌측 입력 폼 */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                직장명 입력
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="예: (주)한국물류, oo테크"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                고용 형태
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                {(['정규직', '계약직'] as EmploymentType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEmploymentType(type)}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      employmentType === type
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 연봉 입력 + 프리셋 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">
                계약 연봉 (세전, 원)
              </label>
              <span className="text-xs font-bold text-blue-700 font-mono-num">
                {formatKRW(Number(annualSalary) || 0)}
              </span>
            </div>
            <input
              type="number"
              min={0}
              step={1000000}
              required
              value={annualSalary}
              onChange={(e) => setAnnualSalary(e.target.value)}
              className="w-full px-3 py-2.5 text-base font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
            />
            <div className="flex flex-wrap gap-1.5">
              {SALARY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAnnualSalary(String(preset))}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md font-mono-num"
                >
                  {(preset / 10000).toLocaleString()}만원
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                퇴직금 기준
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSeveranceIncluded(false)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    !severanceIncluded
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  퇴직금 별도 (÷12)
                </button>
                <button
                  type="button"
                  onClick={() => setSeveranceIncluded(true)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    severanceIncluded
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  퇴직금 포함 (÷13)
                </button>
              </div>
            </div>

            {employmentType === '계약직' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  계약 기간 (개월)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={contractMonths}
                  onChange={(e) => setContractMonths(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  비과세 식대 등 (월, 원)
                </label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={nonTaxableMonthly}
                  onChange={(e) => setNonTaxableMonthly(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {employmentType === '계약직' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  비과세 (월, 원)
                </label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={nonTaxableMonthly}
                  onChange={(e) => setNonTaxableMonthly(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                부양가족 수 (본인포함)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={dependents}
                onChange={(e) => setDependents(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                8~20세 자녀 수
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={childrenCount}
                onChange={(e) => setChildrenCount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono-num"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              비교 목록에 저장
            </button>
          </div>
        </form>

        {/* 우측 계산 결과 */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <span className="text-xs font-medium text-slate-500">
                  {companyName.trim() || '입력 직장'} · {employmentType}
                  {employmentType === '계약직' ? ` (${contractMonths}개월)` : ''}
                </span>
                <p className="text-3xl font-bold tracking-tight text-blue-700 font-mono-num mt-1">
                  월 {formatKRW(breakdown.monthlyNet)}
                </p>
              </div>
              <div className="text-right font-mono-num">
                <p className="text-xs text-slate-500">월 세전</p>
                <p className="text-sm font-bold text-slate-900">
                  {formatKRW(breakdown.monthlyGross)}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>국민연금 (4.5%)</span>
                <span className="font-mono-num">-{formatKRW(breakdown.nationalPension)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>건강보험 (3.545%)</span>
                <span className="font-mono-num">-{formatKRW(breakdown.healthInsurance)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>장기요양보험 (건강보험의 12.95%)</span>
                <span className="font-mono-num">-{formatKRW(breakdown.longTermCare)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>고용보험 (0.9%)</span>
                <span className="font-mono-num">-{formatKRW(breakdown.employmentInsurance)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>근로소득세 (간이세액 근사)</span>
                <span className="font-mono-num">-{formatKRW(breakdown.incomeTax)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>지방소득세 (소득세의 10%)</span>
                <span className="font-mono-num">-{formatKRW(breakdown.localIncomeTax)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-rose-700">
                <span>월 공제액 합계</span>
                <span className="font-mono-num">-{formatKRW(breakdown.totalMonthlyDeduction)}</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5 text-xs">
              {employmentType === '계약직' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      계약기간 ({contractMonths}개월) 예상 실수령 총액
                    </span>
                    <span className="font-bold text-slate-900 font-mono-num">
                      {formatKRW(breakdown.contractTotalNet)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>1년 이상 근무 시 예상 퇴직금</span>
                    <span className="font-mono-num">
                      {breakdown.estimatedSeverance > 0
                        ? formatKRW(breakdown.estimatedSeverance)
                        : '12개월 미만 (해당 없음)'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-slate-600">연간 예상 실수령 총액 (12개월)</span>
                  <span className="font-bold text-slate-900 font-mono-num">
                    {formatKRW(breakdown.annualNet)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 본업(연봉) + 투잡(일당노트 이번 달 실수령) 합산 시뮬레이션 */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-900">
              본업 + 일용직(투잡) 월 수입 합산 시뮬레이션
            </h3>
            <div className="grid grid-cols-3 gap-2 text-xs pt-1">
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-[11px] text-slate-500">본업 월 실수령</p>
                <p className="font-bold text-slate-900 font-mono-num mt-0.5">
                  {formatKRW(breakdown.monthlyNet)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-[11px] text-slate-500">이번 달 일용·투잡</p>
                <p className="font-bold text-emerald-700 font-mono-num mt-0.5">
                  +{formatKRW(currentMonthSideNetPay)}
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                <p className="text-[11px] text-blue-800 font-medium">총 월 합산 실수령</p>
                <p className="font-bold text-blue-700 font-mono-num mt-0.5">
                  {formatKRW(combinedMonthlyNet)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 저장된 연봉 비교 목록 */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">저장된 연봉 비교 목록</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              직장·계약 조건별 실수령액을 저장해 비교하고 클릭 시 다시 불러옵니다
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono-num">{simulations.length}건</span>
        </div>

        {simulations.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">
            저장된 비교 항목이 없습니다. 위에서 직장명과 연봉을 입력한 뒤 ‘비교 목록에 저장’을 눌러보세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[740px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">직장명</th>
                  <th className="py-2.5 px-3">고용형태</th>
                  <th className="py-2.5 px-3 text-right">연봉 (세전)</th>
                  <th className="py-2.5 px-3 text-right">월 세전</th>
                  <th className="py-2.5 px-3 text-right">월 공제액</th>
                  <th className="py-2.5 px-3 text-right">월 실수령액</th>
                  <th className="py-2.5 px-3 text-right">투잡 합산 월수입</th>
                  <th className="py-2.5 px-4 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {simulations.map((sim) => {
                  const res = calculateKoreanAnnualSalary(sim);
                  return (
                    <tr
                      key={sim.id}
                      onClick={() => handleLoadSimulation(sim)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {sim.companyName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {sim.employmentType}
                        {sim.employmentType === '계약직' ? ` (${sim.contractMonths}개월)` : ''}
                        {sim.severanceIncluded ? ' · 퇴직금포함' : ''}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-700">
                        {formatKRW(sim.annualSalary)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-slate-600">
                        {formatKRW(res.monthlyGross)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-num text-rose-700">
                        -{formatKRW(res.totalMonthlyDeduction)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono-num text-blue-700">
                        {formatKRW(res.monthlyNet)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold font-mono-num text-slate-900">
                        {formatKRW(res.monthlyNet + currentMonthSideNetPay)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSimulation(sim.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50"
                          aria-label="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
