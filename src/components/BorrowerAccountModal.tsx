import { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle, DollarSign, Calendar, TrendingUp, ChevronDown, ChevronUp, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Database, RepaymentFrequency } from '../types/database';
import { useAuth } from '../contexts/AuthContext';

type Loan = Database['public']['Tables']['loans']['Row'];
type Repayment = Database['public']['Tables']['repayments']['Row'];

interface LoanWithPayments extends Loan {
  totalPaid: number;
  remainder: number;
  repayments: Repayment[];
}

interface BorrowerAccountModalProps {
  borrowerName: string;
  borrowerEmail: string;
  isRegistered: boolean;
  loans: Loan[];
  onClose: () => void;
  onUpdate: () => void;
}

export const BorrowerAccountModal = ({
  borrowerName,
  borrowerEmail,
  isRegistered,
  loans,
  onClose,
  onUpdate,
}: BorrowerAccountModalProps) => {
  const { user } = useAuth();
  const [loansWithPayments, setLoansWithPayments] = useState<LoanWithPayments[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showAddPaymentForLoan, setShowAddPaymentForLoan] = useState<string | null>(null);

  const [newLoan, setNewLoan] = useState({
    amount: '',
    interestRate: '0',
    frequency: 'monthly' as RepaymentFrequency,
    notes: '',
  });
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [loanError, setLoanError] = useState('');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  useEffect(() => {
    fetchLoansWithRepayments();
  }, [loans]);

  const fetchLoansWithRepayments = async () => {
    setLoading(true);
    try {
      const loanIds = loans.map(l => l.id);
      const { data: repayments, error } = await supabase
        .from('repayments')
        .select('*')
        .in('loan_id', loanIds);

      if (error) throw error;

      const enriched = loans.map(loan => {
        const loanRepayments = (repayments || []).filter(r => r.loan_id === loan.id);
        const totalPaid = loanRepayments.filter(r => r.paid).reduce((sum, r) => sum + Number(r.amount), 0);
        return {
          ...loan,
          totalPaid,
          remainder: Number(loan.amount) - totalPaid,
          repayments: loanRepayments.sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()),
        };
      });

      setLoansWithPayments(enriched);
    } catch (err) {
      console.error('Error fetching repayments:', err);
      setLoansWithPayments(loans.map(l => ({ ...l, totalPaid: 0, remainder: Number(l.amount), repayments: [] })));
    } finally {
      setLoading(false);
    }
  };

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoanError('');
    setLoanSubmitting(true);

    try {
      const { data: borrowerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', borrowerEmail)
        .maybeSingle();

      const { error } = await supabase.from('loans').insert({
        lender_id: user?.id,
        borrower_id: borrowerProfile?.id || null,
        borrower_name: borrowerName,
        borrower_email: borrowerEmail,
        amount: parseFloat(newLoan.amount),
        interest_rate: parseFloat(newLoan.interestRate),
        frequency: newLoan.frequency,
        status: 'active',
        notes: newLoan.notes,
      });

      if (error) throw error;

      try {
        const { data: lenderProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user?.id ?? '')
          .maybeSingle();

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-loan-invitation`;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');

        await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            borrowerEmail,
            borrowerName,
            amount: newLoan.amount,
            lenderName: lenderProfile?.full_name || 'A lender',
          }),
        });
      } catch (emailErr) {
        console.error('Email notification failed:', emailErr);
      }

      setNewLoan({ amount: '', interestRate: '0', frequency: 'monthly', notes: '' });
      setShowAddLoan(false);
      onUpdate();
    } catch (err: unknown) {
      setLoanError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoanSubmitting(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent, loan: LoanWithPayments) => {
    e.preventDefault();
    if (!paymentAmount || !paymentDate) return;
    setPaymentSubmitting(true);

    try {
      const { error } = await supabase.from('repayments').insert({
        loan_id: loan.id,
        amount: Number(paymentAmount),
        due_date: paymentDate,
        paid: true,
        paid_at: new Date().toISOString(),
      });

      if (error) throw error;

      const newTotalPaid = loan.totalPaid + Number(paymentAmount);
      if (newTotalPaid >= Number(loan.amount) && loan.status !== 'completed') {
        await supabase.from('loans').update({ status: 'completed' }).eq('id', loan.id);
      }

      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setShowAddPaymentForLoan(null);
      onUpdate();
    } catch (err) {
      console.error('Error adding payment:', err);
      alert('Failed to add payment. Please try again.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string, loan: LoanWithPayments) => {
    if (!confirm('Delete this payment?')) return;

    try {
      const { error } = await supabase.from('repayments').delete().eq('id', paymentId);
      if (error) throw error;

      const deletedPayment = loan.repayments.find(r => r.id === paymentId);
      const newTotalPaid = loan.totalPaid - Number(deletedPayment?.amount || 0);

      if (newTotalPaid < Number(loan.amount) && loan.status === 'completed') {
        await supabase.from('loans').update({ status: 'active' }).eq('id', loan.id);
      }

      onUpdate();
    } catch (err) {
      console.error('Error deleting payment:', err);
      alert('Failed to delete payment. Please try again.');
    }
  };

  const handleDeleteLoan = async (loan: LoanWithPayments) => {
    if (!confirm('Permanently delete this loan and all its payments? This cannot be undone.')) return;

    try {
      await supabase.from('repayments').delete().eq('loan_id', loan.id);
      const { error } = await supabase.from('loans').delete().eq('id', loan.id);
      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error('Error deleting loan:', err);
      alert('Failed to delete loan. Please try again.');
    }
  };

  const handleToggleLoanStatus = async (loan: LoanWithPayments) => {
    const newStatus = loan.status === 'completed' ? 'active' : 'completed';
    if (!confirm(`${newStatus === 'completed' ? 'Mark' : 'Reactivate'} this loan?`)) return;

    try {
      const { error } = await supabase.from('loans').update({ status: newStatus }).eq('id', loan.id);
      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error('Error updating loan status:', err);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const totalOwed = loansWithPayments.filter(l => l.status === 'active').reduce((sum, l) => sum + l.remainder, 0);
  const totalBorrowed = loansWithPayments.reduce((sum, l) => sum + Number(l.amount), 0);
  const totalPaidOverall = loansWithPayments.reduce((sum, l) => sum + l.totalPaid, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">{borrowerName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">{borrowerEmail}</span>
              {isRegistered ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Registered
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  <UserX className="w-3 h-3 mr-1" />
                  Not Registered
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition ml-4">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Total Borrowed</p>
              <p className="text-base sm:text-lg font-bold text-gray-900">{formatCurrency(totalBorrowed)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 sm:p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Total Paid</p>
              <p className="text-base sm:text-lg font-bold text-green-700">{formatCurrency(totalPaidOverall)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 sm:p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Outstanding</p>
              <p className="text-base sm:text-lg font-bold text-blue-700">{formatCurrency(totalOwed)}</p>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-gray-900">Loans ({loansWithPayments.length})</h3>
            <button
              onClick={() => { setShowAddLoan(!showAddLoan); setLoanError(''); }}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Loan
            </button>
          </div>

          {showAddLoan && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Add New Loan for {borrowerName}</h4>
              {loanError && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{loanError}</div>
              )}
              <form onSubmit={handleAddLoan} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Loan Amount ($)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={newLoan.amount}
                      onChange={e => setNewLoan({ ...newLoan, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="1000.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={newLoan.interestRate}
                      onChange={e => setNewLoan({ ...newLoan, interestRate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Repayment Frequency</label>
                    <select
                      value={newLoan.frequency}
                      onChange={e => setNewLoan({ ...newLoan, frequency: e.target.value as RepaymentFrequency })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Notes (Optional)</label>
                    <input
                      type="text"
                      value={newLoan.notes}
                      onChange={e => setNewLoan({ ...newLoan, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Optional notes..."
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loanSubmitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
                  >
                    {loanSubmitting ? 'Creating...' : 'Create Loan'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddLoan(false)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : loansWithPayments.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-sm">No loans yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {loansWithPayments.map(loan => (
                <div key={loan.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${loan.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(Number(loan.amount))}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${loan.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                            {loan.status === 'active' ? (
                              <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Active</span>
                            ) : (
                              <span className="inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Completed</span>
                            )}
                          </span>
                          {loan.notes && <span className="text-xs text-gray-400 truncate max-w-[120px] hidden sm:block">{loan.notes}</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatCurrency(loan.totalPaid)} paid &middot; {formatCurrency(loan.remainder)} remaining &middot; Created {formatDate(loan.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {expandedLoanId === loan.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  {expandedLoanId === loan.id && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <div>
                          <p className="text-xs text-gray-500">Original Amount</p>
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(loan.amount))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Interest Rate</p>
                          <p className="text-sm font-medium text-gray-900">{loan.interest_rate}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Frequency</p>
                          <p className="text-sm font-medium text-gray-900 capitalize">{loan.frequency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Status</p>
                          <p className="text-sm font-medium text-gray-900 capitalize">{loan.status}</p>
                        </div>
                      </div>

                      {loan.notes && (
                        <div className="mb-4 text-xs text-gray-600 bg-white rounded p-2 border border-gray-200">
                          <span className="font-medium">Notes:</span> {loan.notes}
                        </div>
                      )}

                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-semibold text-gray-900">Payment History</h4>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setShowAddPaymentForLoan(showAddPaymentForLoan === loan.id ? null : loan.id);
                            setPaymentAmount('');
                            setPaymentDate(new Date().toISOString().split('T')[0]);
                          }}
                          className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition text-xs font-medium"
                        >
                          <Plus className="w-3 h-3" />
                          Add Payment
                        </button>
                      </div>

                      {showAddPaymentForLoan === loan.id && (
                        <form
                          onSubmit={e => handleAddPayment(e, loan)}
                          className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Payment Amount</label>
                              <div className="relative">
                                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                  type="number"
                                  step="0.01"
                                  value={paymentAmount}
                                  onChange={e => setPaymentAmount(e.target.value)}
                                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                  placeholder="0.00"
                                  required
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
                              <div className="relative">
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                  type="date"
                                  value={paymentDate}
                                  onChange={e => setPaymentDate(e.target.value)}
                                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={paymentSubmitting}
                              className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition text-xs font-medium disabled:opacity-50"
                            >
                              {paymentSubmitting ? 'Adding...' : 'Add Payment'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAddPaymentForLoan(null)}
                              className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-300 transition text-xs font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}

                      {loan.repayments.length === 0 ? (
                        <div className="text-center py-4 bg-white rounded-lg border border-gray-200">
                          <p className="text-gray-400 text-xs">No payments recorded yet</p>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Paid On</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Delete</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {loan.repayments.map(payment => (
                                <tr key={payment.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-xs text-gray-900">{formatDate(payment.due_date)}</td>
                                  <td className="px-3 py-2 text-xs font-medium text-gray-900">{formatCurrency(Number(payment.amount))}</td>
                                  <td className="px-3 py-2 text-xs text-gray-500 hidden sm:table-cell">
                                    {payment.paid_at ? formatDate(payment.paid_at) : '-'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <button
                                      onClick={() => handleDeletePayment(payment.id, loan)}
                                      className="text-red-500 hover:text-red-700 transition"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => handleToggleLoanStatus(loan)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            loan.status !== 'completed'
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                          }`}
                        >
                          {loan.status !== 'completed' ? (
                            <><CheckCircle className="w-3.5 h-3.5" /> Mark Completed</>
                          ) : (
                            <>Reactivate Loan</>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteLoan(loan)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete Loan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
