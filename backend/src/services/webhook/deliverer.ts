import { getPrisma } from '../../config/prisma.js';
import { signWebhookPayload } from './signer.js';
import type { WebhookDeliveryJobData } from '../../types/index.js';

/**
 * Webhook deliverer — called by the BullMQ webhook-delivery worker.
 *
 * 1. Signs the payload with HMAC-SHA256
 * 2. POSTs to the endpoint URL with signature headers
 * 3. Records the HTTP status and updates the delivery record
 */

export async function deliverWebhook(jobData: WebhookDeliveryJobData): Promise<void> {
  const prisma = getPrisma();
  const { deliveryId, endpointUrl, signingSecret, payload } = jobData;

  let httpStatus: number | null = null;

  try {
    // Sign the payload
    const headers = signWebhookPayload(signingSecret, payload);

    // Send HTTP POST
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { ...headers },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    httpStatus = response.status;

    if (!response.ok) {
      throw new Error(`Webhook delivery failed with status ${httpStatus}`);
    }

    console.log(`📤 Webhook delivered to ${endpointUrl} — ${httpStatus}`);
  } catch (err: any) {
    console.error(`📤 Webhook delivery failed to ${endpointUrl}:`, err.message);
    // Re-throw to let BullMQ handle retries
    throw err;
  } finally {
    // Update delivery record
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        httpStatus,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
  }
}
