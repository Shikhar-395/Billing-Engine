import crypto from 'crypto';

/**
 * Signs a payload using HMAC-SHA256.
 *
 * Signature format: HMAC-SHA256(secret, timestamp + '.' + payloadString)
 * This is used for outbound webhook signing.
 */
export function signPayload(
  secret: string,
  timestamp: number,
  payload: Record<string, any>
): string {
  const payloadString = JSON.stringify(payload);
  const signatureInput = `${timestamp}.${payloadString}`;
  return crypto.createHmac('sha256', secret).update(signatureInput).digest('hex');
}

/**
 * Verifies a webhook signature.
 * Rejects requests where the timestamp is older than `maxAgeSeconds` (default: 300 = 5 min).
 */
export function verifySignature(
  secret: string,
  signature: string,
  timestamp: number,
  payload: Record<string, any>,
  maxAgeSeconds = 300
): boolean {
  // Check timestamp freshness — prevents replay attacks
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - timestamp > maxAgeSeconds) {
    return false;
  }

  const expectedSignature = signPayload(secret, timestamp, payload);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Generates a cryptographically secure signing secret for webhook endpoints.
 */
export function generateSigningSecret(): string {
  return `whk_${crypto.randomBytes(32).toString('hex')}`;
}
