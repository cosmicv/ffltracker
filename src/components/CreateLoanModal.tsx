import { useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RepaymentFrequency } from '../types/database';
import { X } from 'lucide-react';

interface CreateLoanModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateLoanModal = ({ onClose, onSuccess }: CreateLoanModalProps) => {
  const { user } = useAuth();
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Upsert borrower profile and get their ID
      const { data: borrowerProfileId, error: profileFnError } = await supabase
        .rpc('upsert_borrower_profile', {
          p_email: formData.borrowerEmail,
          p_full_name: formData.borrowerName,
        });

      if (profileFnError) {
        console.warn('Could not upsert borrower profile:', profileFnError.message);
      }

      const { error: loanError } = await supabase.from('loans').insert({
        lender_id: user?.id,
        borrower_id: borrowerProfileId || null,
        borrower_name: formData.borrowerName,
        borrower_email: formData.borrowerEmail,
        amount: parseFloat(formData.amount),
        interest_rate: parseFloat(formData.interestRate),
        frequency: formData.frequency,
        status: 'active',
        notes: formData.notes,
      });

      if (loanError) throw loanError;

      try {
        const { data: lenderProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user?.id ?? '')
          .maybeSingle();

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-loan-invitation`;
        console.log('🔵 [EMAIL] Starting email notification process...');
        console.log('🔵 [EMAIL] API URL:', apiUrl);
        console.log('🔵 [EMAIL] Sending to:', formData.borrowerEmail);
        console.log('🔵 [EMAIL] Borrower name:', formData.borrowerName);
        console.log('🔵 [EMAIL] Amount:', formData.amount);
        console.log('🔵 [EMAIL] Lender name:', lenderProfile?.full_name || 'A lender');

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            borrowerEmail: formData.borrowerEmail,
            borrowerName: formData.borrowerName,
            amount: formData.amount,
            lenderName: lenderProfile?.full_name || 'A lender',
          }),
        });

        console.log('🔵 [EMAIL] Response status:', response.status, response.statusText);

        const emailResult = await response.json();
        console.log('🔵 [EMAIL] Response body:', JSON.stringify(emailResult, null, 2));

        if (!emailResult.success) {
          console.error('🔴 [EMAIL] Email notification failed:', emailResult);
        } else {
          console.log('✅ [EMAIL] Email sent successfully!');
          if (emailResult.message && emailResult.message.includes('not configured')) {
            console.warn('⚠️ [EMAIL] Email service not configured');
          }
        }
      } catch (emailError) {
        console.error('🔴 [EMAIL] Exception sending email:', emailError);
        alert(`Failed to send email notification: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`);
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Create New Loan</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Borrower Name
              </label>
              <input
                type="text"
                required
                value={formData.borrowerName}
                onChange={(e) => setFormData({ ...formData, borrowerName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Borrower Email
              </label>
              <input
                type="email"
                required
                value={formData.borrowerEmail}
                onChange={(e) => setFormData({ ...formData, borrowerEmail: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Loan Amount ($)
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="1000.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interest Rate (%)
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="5.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Repayment Frequency
            </label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value as RepaymentFrequency })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Any additional details about the loan..."
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
