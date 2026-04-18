import { getStripe } from '../../config/stripe';
import { getPrisma } from '../../config/prisma';

/**
 * Stripe customer management.
 */

/**
 * Creates or retrieves a Stripe customer for a tenant.
 */
export async function getOrCreateStripeCustomer(
  tenantId: string
): Promise<string> {
  const prisma = getPrisma();
  const stripe = getStripe();

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  // Return existing Stripe customer ID if present
  if (tenant.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    name: tenant.name,
    metadata: {
      tenantId: tenant.id,
      slug: tenant.slug,
    },
  });

  // Store Stripe customer ID
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { stripeCustomerId: customer.id },
  });

  console.log(`💳 Stripe customer created: ${customer.id} for tenant ${tenantId}`);
  return customer.id;
}

/**
 * Retrieves a Stripe customer.
 */
export async function getStripeCustomer(stripeCustomerId: string) {
  const stripe = getStripe();
  return stripe.customers.retrieve(stripeCustomerId);
}
