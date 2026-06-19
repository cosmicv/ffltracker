import { FormEvent, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { RepaymentFrequency } from '../types/database';

interface CreateLoanModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateLoanModal = ({ onClose, onSuccess }: CreateLoanModalProps) => {
  const [formData, setFormData] = useState({
    borrowerName: '',
    borrowerEmail: '',
    amount: '',
    interestRate: '0',
    frequency: 'monthly' as RepaymentFrequency,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.loans.create({
        borrower_name: formData.borrowerName,
        borrower_email: formData.borrowerEmail,
        amount: Number(formData.amount),
        interest_rate: Number(formData.interestRate),
        frequency: formData.frequency,
        status: 'active',
        notes: formData.notes,
      });
      api.emails.invite(formData.borrowerEmail, formData.borrowerName)
        .catch((emailError) => console.error('Invitation email failed:', emailError));
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create loan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Create New Loan</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="text-sm font-medium text-gray-700">
              Borrower Name
              <input
                required
                value={formData.borrowerName}
                onChange={(e) => setFormData({ ...formData, borrowerName: e.target.value })}
                className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Borrower Email
              <input
                type="email"
                required
                value={formData.borrowerEmail}
                onChange={(e) => setFormData({ ...formData, borrowerEmail: e.target.value })}
                className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Loan Amount ($)
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Interest Rate (%)
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Repayment Frequency
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value as RepaymentFrequency })}
              className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Notes
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
