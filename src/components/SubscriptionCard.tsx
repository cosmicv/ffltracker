import { useState } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { StripeProduct } from '../stripe-config';
import { createCheckoutSession } from '../lib/stripe';

interface SubscriptionCardProps {
  product: StripeProduct;
  isActive?: boolean;
  activeSubscriptionName?: string | null;
}

const FEATURES = [
  'Create and manage unlimited loans',
  'Track repayment schedules',
  'Automatic payment reminders via email',
  'Invite borrowers to view their loans',
  'Full dashboard with loan analytics',
];

export function SubscriptionCard({ product, activeSubscriptionName }: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async () => {
    setLoading(true);
    setError('');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const isCurrentPlan = activeSubscriptionName === product.name;

  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden ${
      isCurrentPlan ? 'border-green-500' : 'border-gray-200'
    }`}>
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-900">{product.name}</h3>
          {isCurrentPlan && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <Check className="w-3 h-3" />
              Current Plan
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm">For admins who issue and manage loans</p>
        <div className="mt-4">
          <span className="text-4xl font-bold text-gray-900">${product.price}</span>
          <span className="text-gray-500 ml-1">/year</span>
        </div>
      </div>

      <div className="p-6 space-y-3">
        {FEATURES.map((feature) => (
          <div key={feature} className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-green-600" />
            </div>
            <span className="text-sm text-gray-700">{feature}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="p-6 bg-gray-50 border-t border-gray-100">
        <button
          onClick={handleSubscribe}
          disabled={loading || isCurrentPlan}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition ${
            isCurrentPlan
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              Subscribe Now
            </>
          )}
        </button>
        <p className="text-center text-xs text-gray-500 mt-3">
          Cancel anytime. Access continues through your paid year.
        </p>
      </div>
    </div>
  );
}
