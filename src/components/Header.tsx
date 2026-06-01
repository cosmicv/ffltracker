import { User as SupabaseUser } from '@supabase/supabase-js';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, LogOut, User, CreditCard } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';

interface HeaderProps {
  user: SupabaseUser | null;
}

export function Header({ user }: HeaderProps) {
  const { signOut } = useAuth();
  const { activeSubscriptionName } = useSubscription();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            to="/dashboard"
            className="flex items-center space-x-2 text-xl font-bold text-gray-900"
          >
            <Building2 className="h-8 w-8 text-blue-600" />
            <span>PropertyManager</span>
          </Link>
          
          <div className="flex items-center space-x-4">
            {activeSubscriptionName && (
              <span className="text-sm text-green-600 font-medium">
                {activeSubscriptionName}
              </span>
            )}
            
            <Link
              to="/subscription"
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Subscription
            </Link>
            
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              <User className="h-4 w-4" />
              <span>{user?.email}</span>
            </div>
            
            <button
              onClick={handleSignOut}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
