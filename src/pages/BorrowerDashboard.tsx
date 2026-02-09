import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { DollarSign, CheckCircle, LogOut } from 'lucide-react';
import { LoansList } from '../components/LoansList';

type Loan = Database['public']['Tables']['loans']['Row'];

export const BorrowerDashboard = () => {
  const { profile, signOut } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching loans:', error);
        throw error;
      }

      setLoans(data || []);
      setActiveLoans(data || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-blue-600" />
              <h1 className="ml-2 text-xl font-bold text-gray-900">My Loans</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[150px] sm:max-w-none">
                {profile?.full_name}
              </span>
              <button
                onClick={signOut}
                className="flex items-center text-gray-600 hover:text-gray-900 transition"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading loans...</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Active Loans</h3>
              {activeLoans.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No active loans</p>
                </div>
              ) : (
                <LoansList loans={activeLoans} onUpdate={fetchLoans} isAdmin={false} />
              )}
            </div>

            {loans.filter(l => l.status === 'completed' || l.status === 'rejected').length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Loan History</h3>
                <LoansList
                  loans={loans.filter(l => l.status === 'completed' || l.status === 'rejected')}
                  onUpdate={fetchLoans}
                  isAdmin={false}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
