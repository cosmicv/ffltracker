import React, { useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { StripeProduct } from '../stripe-config';
import { createCheckoutSession } from '../lib/stripe';

interface SubscriptionCardProps {
  product: StripeProduct;
  isActive?: boolean;
  activeSubscriptionName?: string | null;
}

export function SubscriptionCard({ product, isActive, activeSubscriptionName }: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { url } = await createCheckoutSession({
        priceId: product.priceId,
        mode: product.mode,
        successUrl: `${window.location.origin}/success`,
        cancelUrl: window.location.href,
      });

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setLoading(false);
    }
  };

  const isCurrentPlan = activeSubscriptionName === product.name;

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 border-2 ${
      isCurrentPlan ? 'border-green-500' : 'border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
        {isCurrentPlan && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Check className="w-3 h-3 mr-1" />
            Current Plan
          </span>
        )}
      </div>
      
      <p className="text-gray-600 mb-4">{product.description}</p>
      
      <div className="mb-6">
        <span className="text-3xl font-bold text-gray-900">
          ${product.price}
        </span>
        <span className="text-gray-600 ml-1">
          /{product.mode === 'subscription' ? 'year' : 'one-time'}
        </span>
      </div>

      <button
        onClick={handleSubscribe}
        disabled={loading || isCurrentPlan}
        className={`w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
          isCurrentPlan
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        ) : isCurrentPlan ? (
          'Current Plan'
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            {product.mode === 'subscription' ? 'Subscribe' : 'Purchase'}
          </>
        )}
      </button>
    </div>
  );
}