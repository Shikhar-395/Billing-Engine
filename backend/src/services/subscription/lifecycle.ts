import { SubscriptionStatus } from '@prisma/client';

/**
 * Subscription lifecycle finite state machine.
 *
 * Valid transitions:
 *   TRIALING → ACTIVE (trial ended, payment succeeded)
 *   TRIALING → CANCELLED (trial cancelled)
 *   ACTIVE → PAST_DUE (payment failed)
 *   ACTIVE → CANCELLED (user cancelled)
 *   PAST_DUE → ACTIVE (payment recovered via dunning)
 *   PAST_DUE → CANCELLED (dunning exhausted)
 *   UNPAID → CANCELLED (payment never recovered)
 *   CANCELLED → (terminal state)
 */

const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIALING: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAST_DUE', 'CANCELLED'],
  PAST_DUE: ['ACTIVE', 'CANCELLED', 'UNPAID'],
  UNPAID: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [], // terminal state
};

/**
 * Checks if a state transition is valid.
 */
export function isValidTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Returns all valid next states from the current state.
 */
export function validNextStates(current: SubscriptionStatus): SubscriptionStatus[] {
  return VALID_TRANSITIONS[current] || [];
}

/**
 * Error thrown when an invalid state transition is attempted.
 */
export class InvalidTransitionError extends Error {
  constructor(from: SubscriptionStatus, to: SubscriptionStatus) {
    super(
      `Invalid subscription transition: ${from} → ${to}. Valid transitions: ${VALID_TRANSITIONS[from].join(', ') || 'none (terminal state)'}`
    );
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Asserts a transition is valid, throws if not.
 */
export function assertTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}
