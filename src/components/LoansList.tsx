import { Database } from '../types/database';
import { TrendingUp, CheckCircle, UserCheck, UserX, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BorrowerAccountModal } from './BorrowerAccountModal';

type Loan = Database['public']['Tables']['loans']['Row'];

interface BorrowerGroup {
  borrowerName: string;
  borrowerEmail: string;
  isRegistered: boolean;
  loans: Loan[];
  totalBorrowed: number;
  totalPaid: number;
  remainder: number;
  activeLoans: number;
  completedLoans: number;
}

interface LoansListProps {
  loans: Loan[];
  onUpdate: () => void;
  isAdmin: boolean;
}

export const LoansList = ({ loans, isAdmin, onUpdate }: LoansListProps) => {
  const [borrowerGroups, setBorrowerGroups] = useState<BorrowerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBorrower, setSelectedBorrower] = useState<BorrowerGroup | null>(null);

  useEffect(() => {
    buildBorrowerGroups();
  }, [loans]);

  const buildBorrowerGroups = async () => {
    setLoading(true);
    try {
      const loanIds = loans.map(l => l.id);
      type Repayment = Database['public']['Tables']['repayments']['Row'];
      const { data: repaymentData, error } = await supabase
        .from('repayments')
        .select('*')
        .in('loan_id', loanIds);

      if (error) throw error;

      const repayments = (repaymentData as Repayment[]) ?? [];
      const grouped = new Map<string, BorrowerGroup>();

      for (const loan of loans) {
        const key = loan.borrower_email.toLowerCase();
        const loanRepayments = repayments.filter(r => r.loan_id === loan.id && r.paid);
        const paidForLoan = loanRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
        const remainderForLoan = Number(loan.amount) - paidForLoan;

        if (!grouped.has(key)) {
          let isRegistered = false;
          if (isAdmin && loan.borrower_email) {
            const { data } = await supabase.rpc('check_borrower_registered', {
              borrower_email_param: loan.borrower_email,
            });
            isRegistered = (data as boolean) === true;
          }
          grouped.set(key, {
            borrowerName: loan.borrower_name,
            borrowerEmail: loan.borrower_email,
            isRegistered,
            loans: [],
            totalBorrowed: 0,
            totalPaid: 0,
            remainder: 0,
            activeLoans: 0,
            completedLoans: 0,
          });
        }

        const group = grouped.get(key)!;
        group.loans.push(loan);
        group.totalBorrowed += Number(loan.amount);
        group.totalPaid += paidForLoan;
        group.remainder += remainderForLoan;
        if (loan.status === 'active') group.activeLoans++;
        if (loan.status === 'completed') group.completedLoans++;
      }

      setBorrowerGroups(Array.from(grouped.values()));
    } catch (err) {
      console.error('Error building borrower groups:', err);
      const fallback = new Map<string, BorrowerGroup>();
      for (const loan of loans) {
        const key = loan.borrower_email.toLowerCase();
        if (!fallback.has(key)) {
          fallback.set(key, {
            borrowerName: loan.borrower_name,
            borrowerEmail: loan.borrower_email,
            isRegistered: false,
            loans: [],
            totalBorrowed: 0,
            totalPaid: 0,
            remainder: 0,
            activeLoans: 0,
            completedLoans: 0,
          });
        }
        const group = fallback.get(key)!;
        group.loans.push(loan);
        group.totalBorrowed += Number(loan.amount);
        group.remainder += Number(loan.amount);
        if (loan.status === 'active') group.activeLoans++;
        if (loan.status === 'completed') group.completedLoans++;
      }
      setBorrowerGroups(Array.from(fallback.values()));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (loans.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No loans found</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {borrowerGroups.map(group => (
          <div
            key={group.borrowerEmail}
            onClick={() => setSelectedBorrower(group)}
            className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                {group.borrowerName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{group.borrowerName}</span>
                  {isAdmin && (
                    group.isRegistered ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <UserCheck className="w-3 h-3 mr-0.5" />
                        Registered
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        <UserX className="w-3 h-3 mr-0.5" />
                        Not Registered
                      </span>
                    )
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{group.borrowerEmail}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {group.activeLoans > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                      <TrendingUp className="w-3 h-3" />
                      {group.activeLoans} active
                    </span>
                  )}
                  {group.completedLoans > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      {group.completedLoans} completed
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0 ml-3">
              <div className="hidden sm:block text-right">
                <p className="text-xs text-gray-400">Borrowed</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(group.totalBorrowed)}</p>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-xs text-gray-400">Paid</p>
                <p className="text-sm font-semibold text-green-600">{formatCurrency(group.totalPaid)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Outstanding</p>
                <p className="text-sm font-semibold text-blue-600">{formatCurrency(group.remainder)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition flex-shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {selectedBorrower && (
        <BorrowerAccountModal
          borrowerName={selectedBorrower.borrowerName}
          borrowerEmail={selectedBorrower.borrowerEmail}
          isRegistered={selectedBorrower.isRegistered}
          loans={selectedBorrower.loans}
          onClose={() => setSelectedBorrower(null)}
          onUpdate={() => {
            setSelectedBorrower(null);
            onUpdate();
          }}
        />
      )}
    </>
  );
};
