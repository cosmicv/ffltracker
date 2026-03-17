import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole } from '../types/database';
import { Trash2, Users, Search, AlertTriangle, X, Shield, User, CheckCircle, Mail, Loader2 } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  registered: boolean;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deletedName, setDeletedName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const fetchUsers = async () => {
    try {
      const [{ data: profileData, error: profileError }, { data: loanData, error: loanError }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('loans').select('borrower_email, borrower_name, created_at').order('created_at', { ascending: false }),
      ]);

      if (profileError) throw profileError;
      if (loanError) throw loanError;

      const profiles: Profile[] = profileData || [];
      const profileEmails = new Set(profiles.map(p => p.email.toLowerCase()));

      const seen = new Set<string>();
      const loanOnlyUsers: Profile[] = [];
      for (const loan of loanData || []) {
        const emailKey = loan.borrower_email.toLowerCase();
        if (!profileEmails.has(emailKey) && !seen.has(emailKey)) {
          seen.add(emailKey);
          loanOnlyUsers.push({
            id: emailKey,
            email: loan.borrower_email,
            full_name: loan.borrower_name,
            role: 'borrower' as UserRole,
            created_at: loan.created_at,
            registered: false,
          });
        }
      }

      setUsers([...loanOnlyUsers, ...profiles]);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvite = async (u: Profile) => {
    setResendingInvite(u.id);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data: lenderProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .maybeSingle();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-invite`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            borrowerEmail: u.email,
            borrowerName: u.full_name || u.email,
            lenderName: lenderProfile?.full_name || 'Your lender',
          }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to send invite');
      }
      setSuccessMsg(`Invite sent to ${u.email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setResendingInvite(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ userId: deleteTarget.id }),
        }
      );

      let result: Record<string, string>;
      try {
        result = await response.json();
      } catch {
        throw new Error(`Server error (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(result.error || result.msg || result.message || `Server error (${response.status})`);
      }

      setDeletedName(deleteTarget.full_name || deleteTarget.email);
      setDeleteSuccess(true);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: UserRole) => {
    const styles: Record<string, string> = {
      master_admin: 'bg-amber-100 text-amber-800 border border-amber-200',
      admin: 'bg-blue-100 text-blue-800 border border-blue-200',
      borrower: 'bg-gray-100 text-gray-700 border border-gray-200',
    };
    const labels: Record<string, string> = {
      master_admin: 'Master Admin',
      admin: 'Admin',
      borrower: 'Borrower',
    };
    return (
      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${styles[role] || styles.borrower}`}>
        {labels[role] || role}
      </span>
    );
  };

  const getStatusBadge = (registered: boolean) => {
    if (registered) return null;
    return (
      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
        Pending
      </span>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading users...</p>
      </div>
    );
  }

  return (
    <div>
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>

      {filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Role</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Joined</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        <div className="sm:hidden mt-1 flex items-center gap-1.5 flex-wrap">
                          {getRoleBadge(u.role)}
                          {getStatusBadge(u.registered)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getRoleBadge(u.role)}
                      {getStatusBadge(u.registered)}
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className="text-sm text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {u.role !== 'master_admin' ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleResendInvite(u)}
                          disabled={resendingInvite === u.id}
                          title="Resend invite email"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resendingInvite === u.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                          <span className="hidden sm:inline">
                            {resendingInvite === u.id ? 'Sending...' : 'Resend Invite'}
                          </span>
                        </button>
                        {u.id.includes('@') ? null : (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Protected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            {deleteSuccess ? (
              <>
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle className="w-7 h-7 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">User Removed</h3>
                  <p className="text-sm text-gray-500">
                    <strong>{deletedName}</strong> has been successfully removed along with all associated data.
                  </p>
                </div>
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => {
                      setDeleteTarget(null);
                      setDeleteSuccess(false);
                      setDeletedName('');
                    }}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Delete User</h3>
                    <p className="text-sm text-gray-500">This action cannot be undone</p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-6">
                  <p className="text-sm text-red-800">
                    You are about to permanently delete <strong>{deleteTarget.full_name}</strong> ({deleteTarget.email}).
                    All their loans, repayments, and feedback will also be removed.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg mb-4 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { setDeleteTarget(null); setError(''); }}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {deleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete User
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
