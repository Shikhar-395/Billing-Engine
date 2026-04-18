import { signPayload, verifySignature } from '../../utils/crypto';

/**
 * Webhook signer — HMAC-SHA256 signing for outbound webhooks.
 *
 * Signature format:
 *   HMAC-SHA256(signingSecret, timestamp + '.' + JSON.stringify(payload))
 *
 * Headers sent:
 *   X-Billing-Signature: <hex signature>
 *   X-Billing-Timestamp: <unix timestamp>
 *
 * Receivers validate by:
 * 1. Extracting timestamp from header
 * 2. Rejecting if timestamp > 5 minutes old (replay attack prevention)
 * 3. Computing expected signature and comparing with timing-safe comparison
 */

export interface SignedWebhookHeaders {
  'X-Billing-Signature': string;
  'X-Billing-Timestamp': string;
  'Content-Type': string;
}

/**
 * Signs a webhook payload and returns the headers to include.
 */
export function signWebhookPayload(
  signingSecret: string,
  payload: Record<string, any>
): SignedWebhookHeaders {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(signingSecret, timestamp, payload);

  return {
    'X-Billing-Signature': signature,
    'X-Billing-Timestamp': String(timestamp),
    'Content-Type': 'application/json',
  };
}

/**
 * Verifies an incoming webhook signature (for receivers).
 */
export function verifyWebhookSignature(
  signingSecret: string,
  signature: string,
  timestamp: number,
  payload: Record<string, any>,
  maxAgeSeconds = 300
): boolean {
  return verifySignature(signingSecret, signature, timestamp, payload, maxAgeSeconds);
}
