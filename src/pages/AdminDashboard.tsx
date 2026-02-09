import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { PlusCircle, DollarSign, Users, TrendingUp, LogOut, MessageCircle, Shield } from 'lucide-react';
import { CreateLoanModal } from '../components/CreateLoanModal';
import { LoansList } from '../components/LoansList';
import { FeedbackModal } from '../components/FeedbackModal';
import { UserManagement } from '../components/UserManagement';

type Loan = Database['public']['Tables']['loans']['Row'];

export const AdminDashboard = () => {
  const { profile, signOut } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'loans' | 'users'>('loans');
  const isMasterAdmin = profile?.role === 'master_admin';
  const [stats, setStats] = useState({
    totalLoans: 0,
    totalAmount: 0,
    activeLoans: 0,
    completedLoans: 0,
  });

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
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (loansData: Loan[]) => {
    setStats({
      totalLoans: loansData.length,
      totalAmount: loansData.reduce((sum, loan) => sum + Number(loan.amount), 0),
      activeLoans: loansData.filter(l => l.status === 'active').length,
      completedLoans: loansData.filter(l => l.status === 'completed').length,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-blue-600" />
              <h1 className="ml-2 text-xl font-bold text-gray-900">Family and Friends Loan Tracker</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-xs sm:text-sm text-gray-600 flex items-center flex-wrap gap-1">
                <span className="hidden sm:inline">{profile?.full_name}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${isMasterAdmin ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                  {isMasterAdmin ? 'Master Admin' : 'Admin'}
                </span>
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
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Loans</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalLoans}</p>
                </div>
                <Users className="w-10 h-10 text-blue-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">${stats.totalAmount.toLocaleString()}</p>
                </div>
                <DollarSign className="w-10 h-10 text-green-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Loans</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeLoans}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-500 opacity-80" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Completed Loans</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completedLoans}</p>
                </div>
                <PlusCircle className="w-10 h-10 text-green-500 opacity-80" />
              </div>
            </div>
          </div>
        </div>

        {isMasterAdmin && (
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('loans')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'loans'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Loans
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'users'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Shield className="w-4 h-4" />
              User Management
            </button>
          </div>
        )}

        {activeTab === 'loans' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6 gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">All Loans</h3>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm sm:text-base"
              >
                <PlusCircle className="w-5 h-5 sm:mr-2" />
                <span className="hidden sm:inline">Create Loan</span>
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading loans...</p>
              </div>
            ) : (
              <LoansList loans={loans} onUpdate={fetchLoans} isAdmin={true} />
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-6 h-6 text-amber-600" />
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">User Management</h3>
            </div>
            <UserManagement />
          </div>
        )}

        <div className="mt-8 text-center pb-8">
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            <MessageCircle className="w-5 h-5" />
            Submit Feedback or Report an Issue
          </button>
        </div>
      </div>

      {showCreateModal && (
        <CreateLoanModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchLoans();
          }}
        />
      )}

      {showFeedbackModal && (
        <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
      )}
    </div>
  );
};
