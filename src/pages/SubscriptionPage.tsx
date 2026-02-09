import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionCard } from '../components/SubscriptionCard';
import { stripeProducts } from '../stripe-config';

export function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading, activeSubscriptionName } = useSubscription();

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Choose Your Plan
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Select the perfect plan for your needs
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {stripeProducts.map((product) => (
            <SubscriptionCard
              key={product.id}
              product={product}
              isActive={subscription?.subscription_status === 'active'}
              activeSubscriptionName={activeSubscriptionName}
            />
          ))}
        </div>

        {subscription && (
          <div className="mt-12 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Current Subscription Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-medium capitalize">{subscription.subscription_status}</p>
              </div>
              {subscription.current_period_end && (
                <div>
                  <p className="text-sm text-gray-600">Next Billing Date</p>
                  <p className="font-medium">
                    {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                  </p>
                </div>
              )}
              {subscription.payment_method_brand && subscription.payment_method_last4 && (
                <div>
                  <p className="text-sm text-gray-600">Payment Method</p>
                  <p className="font-medium capitalize">
                    {subscription.payment_method_brand} ending in {subscription.payment_method_last4}
                  </p>
                </div>
              )}
              {subscription.cancel_at_period_end && (
                <div>
                  <p className="text-sm text-gray-600">Cancellation</p>
                  <p className="font-medium text-red-600">
                    Will cancel at period end
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}