import { Database } from '../types/database';
import { CheckCircle, XCircle, TrendingUp, Settings, UserCheck, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LoanDetailsModal } from './LoanDetailsModal';

type Loan = Database['public']['Tables']['loans']['Row'];
type Repayment = Database['public']['Tables']['repayments']['Row'];

interface LoanWithPayments extends Loan {
  totalPaid: number;
  remainder: number;
  isRegistered?: boolean;
}

interface LoansListProps {
  loans: Loan[];
  onUpdate: () => void;
  isAdmin: boolean;
}

export const LoansList = ({ loans, isAdmin, onUpdate }: LoansListProps) => {
  const [loansWithPayments, setLoansWithPayments] = useState<LoanWithPayments[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  useEffect(() => {
    fetchRepayments();
  }, [loans]);

  const fetchRepayments = async () => {
    setLoading(true);
    try {
      const loanIds = loans.map(l => l.id);
      const { data: repayments, error } = await supabase
        .from('repayments')
        .select('*')
        .in('loan_id', loanIds);

      if (error) throw error;

      const loansWithPaymentData = await Promise.all(
        loans.map(async (loan) => {
          const loanRepayments = (repayments || []).filter(r => r.loan_id === loan.id && r.paid);
          const totalPaid = loanRepayments.reduce((sum, r) => sum + Number(r.amount), 0);
          const remainder = Number(loan.amount) - totalPaid;

          let isRegistered = false;
          if (isAdmin && loan.borrower_email) {
            const { data: registrationStatus } = await supabase
              .rpc('check_borrower_registered', { borrower_email: loan.borrower_email });
            isRegistered = registrationStatus || false;
          }

          return {
            ...loan,
            totalPaid,
            remainder,
            isRegistered,
          };
        })
      );

      setLoansWithPayments(loansWithPaymentData);
    } catch (error) {
      console.error('Error fetching repayments:', error);
      setLoansWithPayments(loans.map(loan => ({
        ...loan,
        totalPaid: 0,
        remainder: Number(loan.amount),
        isRegistered: false,
      })));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { bg: 'bg-green-100', text: 'text-green-800', icon: TrendingUp },
      completed: { bg: 'bg-gray-100', text: 'text-gray-800', icon: CheckCircle },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
    };

    const badge = badges[status as keyof typeof badges] || badges.active;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getRegistrationBadge = (isRegistered: boolean) => {
    if (isRegistered) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800" title="User has registered">
          <UserCheck className="w-3 h-3 mr-1" />
          Registered
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800" title="User has not registered yet">
        <UserX className="w-3 h-3 mr-1" />
        Not Registered
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-4">
        {loansWithPayments.map((loan) => (
          <div key={loan.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            {isAdmin && (
              <div className="mb-3 pb-3 border-b border-gray-200">
                <div className="text-sm font-medium text-gray-900">{loan.borrower_name}</div>
                <div className="text-xs text-gray-500 mb-2">{loan.borrower_email}</div>
                {getRegistrationBadge(loan.isRegistered || false)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Original Amount</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(loan.amount))}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Amount Paid</p>
                <p className="text-sm font-semibold text-green-600">{formatCurrency(loan.totalPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Remainder</p>
                <p className="text-sm font-semibold text-blue-600">{formatCurrency(loan.remainder)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Interest Rate</p>
                <p className="text-sm font-medium text-gray-900">{loan.interest_rate}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Frequency</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{loan.frequency}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Created</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(loan.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
              <div>{getStatusBadge(loan.status)}</div>
              {isAdmin && (
                <button
                  onClick={() => setSelectedLoan(loan)}
                  className="flex items-center text-blue-600 hover:text-blue-800 transition font-medium text-sm"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Manage
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Borrower
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Original Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount Paid
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Remainder
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Interest Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Frequency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loansWithPayments.map((loan) => (
              <tr key={loan.id} className="hover:bg-gray-50 transition">
                {isAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{loan.borrower_name}</div>
                      <div className="text-sm text-gray-500 mb-2">{loan.borrower_email}</div>
                      {getRegistrationBadge(loan.isRegistered || false)}
                    </div>
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatCurrency(Number(loan.amount))}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                  {formatCurrency(loan.totalPaid)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                  {formatCurrency(loan.remainder)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {loan.interest_rate}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                  {loan.frequency}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(loan.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(loan.created_at)}
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedLoan(loan)}
                      className="flex items-center text-blue-600 hover:text-blue-800 transition font-medium"
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Manage
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedLoan && (
        <LoanDetailsModal
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
          onUpdate={() => {
            fetchRepayments();
            onUpdate();
          }}
        />
      )}
    </>
  );
};
