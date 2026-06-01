import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { getProductByPriceId } from '../stripe-config';

interface Subscription {
  subscription_status: string;
  price_id: string | null;
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('stripe_user_subscriptions')
          .select('*')
          .maybeSingle();

        if (error) {
          console.error('Error fetching subscription:', error);
          setSubscription(null);
        } else {
          setSubscription(data && data.subscription_status ? {
            subscription_status: data.subscription_status,
            price_id: data.price_id,
            current_period_start: data.current_period_start,
            current_period_end: data.current_period_end,
            cancel_at_period_end: data.cancel_at_period_end ?? false,
            payment_method_brand: data.payment_method_brand,
            payment_method_last4: data.payment_method_last4,
          } : null);
        }
      } catch (err) {
        console.error('Unexpected error fetching subscription:', err);
        setSubscription(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user]);

  const getActiveSubscriptionName = () => {
    if (!subscription || !subscription.price_id) {
      return null;
    }

    const product = getProductByPriceId(subscription.price_id);
    return product?.name || null;
  };

  const status = subscription?.subscription_status;
  const isActive = status === 'active' || status === 'trialing';

  return {
    subscription,
    loading,
    isActive,
    activeSubscriptionName: getActiveSubscriptionName(),
  };
}
