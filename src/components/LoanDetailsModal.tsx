import { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle, DollarSign, Calendar } from 'lucide-react';
import { api } from '../lib/api';
import { Database } from '../types/database';

type Loan = Database['public']['Tables']['loans']['Row'];
type Repayment = Database['public']['Tables']['repayments']['Row'];

interface LoanDetailsModalProps {
  loan: Loan;
  onClose: () => void;
  onUpdate: () => void;
}

export const LoanDetailsModal = ({ loan, onClose, onUpdate }: LoanDetailsModalProps) => {
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRepayments();
  }, [loan.id]);

  const fetchRepayments = async () => {
    try {
      setRepayments(await api.repayments.list([loan.id]));
    } catch (error) {
      console.error('Error fetching repayments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !paymentDate) return;

    setSubmitting(true);
    try {
      await api.repayments.create({
          loan_id: loan.id,
          amount: Number(paymentAmount),
          due_date: paymentDate,
          paid: true,
          paid_at: new Date().toISOString(),
        });

      const updatedRepayments = await api.repayments.list([loan.id]);

      const totalPaid = (updatedRepayments || [])
        .filter(r => r.paid)
        .reduce((sum, r) => sum + Number(r.amount), 0);

      // Auto-complete loan if fully paid
      if (totalPaid >= Number(loan.amount) && loan.status !== 'completed') {
        await api.loans.update(loan.id, { status: 'completed' });

        try {
          await api.emails.status(loan, 'completed');
        } catch (emailError) {
          console.error('Exception sending email:', emailError);
        }
      }

      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setShowAddPayment(false);
      fetchRepayments();
      onUpdate();
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Failed to add payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;

    try {
      await api.repayments.remove(paymentId);

      const updatedRepayments = await api.repayments.list([loan.id]);

      const totalPaid = (updatedRepayments || [])
        .filter(r => r.paid)
        .reduce((sum, r) => sum + Number(r.amount), 0);

      // Update loan status based on whether it's still fully paid
      if (totalPaid >= Number(loan.amount) && loan.status !== 'completed') {
        await api.loans.update(loan.id, { status: 'completed' });
      } else if (totalPaid < Number(loan.amount) && loan.status === 'completed') {
        await api.loans.update(loan.id, { status: 'active' });
      }

      fetchRepayments();
      onUpdate();
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Failed to delete payment. Please try again.');
    }
  };

  const handleCompleteLoan = async () => {
    if (!confirm('Mark this loan as completed? This action can be reversed.')) return;

    try {
      await api.loans.update(loan.id, { status: 'completed' });

      try {
        await api.emails.status(loan, 'completed');
      } catch (emailError) {
        console.error('Exception sending email:', emailError);
      }

      await onUpdate();
      await new Promise(resolve => setTimeout(resolve, 100));
      onClose();
    } catch (error) {
      console.error('Error completing loan:', error);
      alert('Failed to complete loan. Please try again.');
    }
  };

  const handleReactivateLoan = async () => {
    if (!confirm('Reactivate this loan?')) return;

    try {
      await api.loans.update(loan.id, { status: 'active' });

      await onUpdate();
      await new Promise(resolve => setTimeout(resolve, 100));
      onClose();
    } catch (error) {
      console.error('Error reactivating loan:', error);
      alert('Failed to reactivate loan. Please try again.');
    }
  };

  const handleDeleteLoan = async () => {
    if (!confirm('Are you sure you want to permanently delete this loan? This action cannot be undone.')) return;

    try {
      try {
        await api.emails.status(loan, 'deleted');
      } catch (emailError) {
        console.error('Exception sending email:', emailError);
      }

      await api.loans.remove(loan.id);

      await onUpdate();
      await new Promise(resolve => setTimeout(resolve, 100));
      onClose();
    } catch (error) {
      console.error('Error deleting loan:', error);
      alert('Failed to delete loan. Please try again.');
    }
  };

  const totalPaid = repayments.filter(r => r.paid).reduce((sum, r) => sum + Number(r.amount), 0);
  const remainder = Number(loan.amount) - totalPaid;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Manage Loan</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Loan Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Borrower</p>
                <p className="text-base sm:text-lg font-medium text-gray-900">{loan.borrower_name}</p>
                <p className="text-sm text-gray-500 truncate">{loan.borrower_email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Original Amount</p>
                <p className="text-base sm:text-lg font-bold text-gray-900">{formatCurrency(Number(loan.amount))}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Interest Rate</p>
                <p className="text-base sm:text-lg font-medium text-gray-900">{loan.interest_rate}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Amount Paid</p>
                <p className="text-base sm:text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Remainder</p>
                <p className="text-base sm:text-lg font-bold text-blue-600">{formatCurrency(remainder)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="text-base sm:text-lg font-medium text-gray-900 capitalize">{loan.status}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Payment History</h3>
              <button
                onClick={() => setShowAddPayment(!showAddPayment)}
                className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Payment
              </button>
            </div>

            {showAddPayment && (
              <form onSubmit={handleAddPayment} className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Amount
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
                  >
                    {submitting ? 'Adding...' : 'Add Payment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddPayment(false)}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : repayments.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No payments recorded yet</p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="block sm:hidden space-y-3">
                  {repayments.map((payment) => (
                    <div key={payment.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-xs text-gray-500">Date</p>
                          <p className="text-sm font-medium text-gray-900">{formatDate(payment.due_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Amount</p>
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(payment.amount))}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          {payment.paid ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              Pending
                            </span>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {payment.paid_at ? formatDate(payment.paid_at) : 'Not paid yet'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeletePayment(payment.id)}
                          className="text-red-600 hover:text-red-800 transition"
                          title="Delete payment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid On</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {repayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{formatDate(payment.due_date)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(Number(payment.amount))}</td>
                          <td className="px-4 py-3 text-sm">
                            {payment.paid ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {payment.paid_at ? formatDate(payment.paid_at) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => handleDeletePayment(payment.id)}
                              className="text-red-600 hover:text-red-800 transition"
                              title="Delete payment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Loan Actions</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              {loan.status !== 'completed' ? (
                <button
                  onClick={handleCompleteLoan}
                  className="flex items-center justify-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium text-sm sm:text-base"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Mark as Completed
                </button>
              ) : (
                <button
                  onClick={handleReactivateLoan}
                  className="flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm sm:text-base"
                >
                  Reactivate Loan
                </button>
              )}
              <button
                onClick={handleDeleteLoan}
                className="flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium text-sm sm:text-base"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Delete Loan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
