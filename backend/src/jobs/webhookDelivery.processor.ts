import { Job } from 'bullmq';
import { deliverWebhook } from '../services/webhook/deliverer.js';
import type { WebhookDeliveryJobData } from '../types/index.js';

/**
 * Webhook delivery processor.
 * Signs the payload with HMAC-SHA256 and POSTs to the endpoint URL.
 * BullMQ handles retries with exponential backoff (3 attempts).
 */
export async function processWebhookDelivery(
  job: Job<WebhookDeliveryJobData>
): Promise<void> {
  console.log(
    `📤 Delivering webhook ${job.data.eventType} to ${job.data.endpointUrl}`
  );

  await deliverWebhook(job.data);
}
