import { FormEvent, useState } from 'react';
import { CheckCircle, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { api } from '../lib/api';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="py-4 text-center">
            <CheckCircle className="mx-auto mb-3 h-14 w-14 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Password changed</h3>
            <p className="mb-6 text-sm text-gray-600">Your new password is active. Other signed-in sessions have been closed.</p>
            <button onClick={onClose} className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <label className="block text-sm font-medium text-gray-700">
              Current Password
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              New Password
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Confirm New Password
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                autoComplete="new-password"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPasswords ? 'Hide passwords' : 'Show passwords'}
            </button>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
