import Stripe from 'stripe';
import { env } from './env.js';

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-03-31.basil' as any,
      typescript: true,
    });
    console.log('✅ Stripe client initialized');
  }

  return stripe;
}
