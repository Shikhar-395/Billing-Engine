import { getPrisma } from '../../config/prisma.js';
import { InvoiceStatus } from '@prisma/client';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { dispatchWebhookEvent } from '../webhook/dispatcher.js';

/**
 * Invoice manager — handles status transitions: finalize, mark paid, void.
 */

/**
 * Finalizes a DRAFT invoice → OPEN.
 */
export async function finalizeInvoice(invoiceId: string) {
  const prisma = getPrisma();

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice', invoiceId);
  if (invoice.status !== 'DRAFT') {
    throw new ConflictError(`Cannot finalize invoice in ${invoice.status} status`);
  }

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'OPEN' },
    include: { lineItems: true },
  });
}

/**
 * Marks an invoice as PAID.
 */
export async function markInvoicePaid(invoiceId: string) {
  const prisma = getPrisma();

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice', invoiceId);
  if (invoice.status !== 'OPEN') {
    throw new ConflictError(`Cannot mark invoice as paid in ${invoice.status} status`);
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
    include: { lineItems: true },
  });

  // Fire webhook
  await dispatchWebhookEvent(invoice.tenantId, 'invoice.paid', {
    invoiceId: invoice.id,
    invoiceNumber: updated.invoiceNumber,
    customerId: updated.customerId,
    total: invoice.total,
    currency: invoice.currency,
    paidAt: updated.paidAt,
  });

  return updated;
}

/**
 * Voids an invoice, if it's DRAFT or OPEN.
 */
export async function voidInvoice(invoiceId: string) {
  const prisma = getPrisma();

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice', invoiceId);
  if (invoice.status !== 'DRAFT' && invoice.status !== 'OPEN') {
    throw new ConflictError(`Cannot void invoice in ${invoice.status} status`);
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'VOID' },
    include: { lineItems: true },
  });

  // Fire webhook
  await dispatchWebhookEvent(invoice.tenantId, 'invoice.voided', {
    invoiceId: invoice.id,
    invoiceNumber: updated.invoiceNumber,
    customerId: updated.customerId,
    total: invoice.total,
  });

  return updated;
}

/**
 * Marks an invoice as UNCOLLECTIBLE (dunning exhausted).
 */
export async function markInvoiceUncollectible(invoiceId: string) {
  const prisma = getPrisma();

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice', invoiceId);

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'UNCOLLECTIBLE' },
  });
}
