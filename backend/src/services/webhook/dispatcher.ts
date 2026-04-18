import { getPrisma } from '../../config/prisma';
import { webhookDeliveryQueue } from '../../config/queues';
import { WebhookEventType, WebhookDeliveryJobData } from '../../types';

/**
 * Webhook dispatcher.
 *
 * When a business event occurs:
 * 1. Query all active WebhookEndpoints for the tenant that subscribe to this event type
 * 2. Create a WebhookDelivery record for each
 * 3. Enqueue a BullMQ job for each delivery
 */

export async function dispatchWebhookEvent(
  tenantId: string,
  eventType: WebhookEventType,
  payload: Record<string, any>
): Promise<void> {
  const prisma = getPrisma();

  // Find all active endpoints for this tenant that listen for this event type
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      tenantId,
      isActive: true,
    },
  });

  // Filter by event type (stored as JSON string array)
  const matchingEndpoints = endpoints.filter((ep) => {
    const eventTypes = ep.eventTypes as string[];
    return eventTypes.includes(eventType) || eventTypes.includes('*');
  });

  if (matchingEndpoints.length === 0) {
    return;
  }

  // Create delivery records and enqueue jobs
  for (const endpoint of matchingEndpoints) {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        eventType,
        payload: {
          event: eventType,
          data: payload,
          tenantId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    const jobData: WebhookDeliveryJobData = {
      deliveryId: delivery.id,
      endpointId: endpoint.id,
      endpointUrl: endpoint.url,
      signingSecret: endpoint.signingSecret,
      eventType,
      payload: delivery.payload as Record<string, any>,
    };

    await webhookDeliveryQueue().add('deliver', jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }
}
