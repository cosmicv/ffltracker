import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionCard } from '../components/SubscriptionCard';
import { stripeProducts } from '../stripe-config';
import { createPortalSession } from '../lib/stripe';
import { ArrowLeft, CreditCard, Calendar, AlertTriangle, ExternalLink, Settings } from 'lucide-react';

export function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading, isActive, activeSubscriptionName } = useSubscription();
  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setPortalError('');
    try {
      const { url } = await createPortalSession(window.location.href);
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Failed to open subscription management');
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {isActive && subscription ? (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Subscription Management</h1>
              <p className="mt-1 text-gray-500">View and manage your current subscription</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{activeSubscriptionName || 'Active Plan'}</h2>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Status</p>
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {subscription.cancel_at_period_end ? 'Canceling' : subscription.subscription_status}
                  </p>
                </div>

                {subscription.current_period_end && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                      {subscription.cancel_at_period_end ? 'Access Until' : 'Next Billing Date'}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(subscription.current_period_end * 1000).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {subscription.payment_method_brand && subscription.payment_method_last4 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Payment Method</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {subscription.payment_method_brand} ending in {subscription.payment_method_last4}
                    </p>
                  </div>
                )}
              </div>

              {subscription.cancel_at_period_end && (
                <div className="mx-6 mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Subscription is set to cancel</p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      You will retain access until {new Date(subscription.current_period_end! * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
                      You can reactivate at any time before then.
                    </p>
                  </div>
                </div>
              )}

              {portalError && (
                <div className="mx-6 mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{portalError}</p>
                </div>
              )}

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {portalLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Opening...
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4" />
                      Manage Subscription
                      <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Update payment method, view invoices, or cancel your subscription
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Choose Your Plan</h1>
              <p className="mt-2 text-gray-500">Select the perfect plan for your needs</p>
            </div>

            <div className="max-w-lg mx-auto">
              {stripeProducts.map((product) => (
                <SubscriptionCard
                  key={product.id}
                  product={product}
                  isActive={false}
                  activeSubscriptionName={activeSubscriptionName}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
