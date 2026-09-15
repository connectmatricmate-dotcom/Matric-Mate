import { tierOf } from '@matricmate/core';
import type { StringKey } from '../i18n';

/**
 * The plan's name, one way everywhere in the app.
 *
 * Settings named a plan by its tier and the subscription screen by its stored
 * id, so an old year-long Premium row read "Premium" on one and "Full year" on
 * the other. The tier is what the student holds (a retired length is Premium,
 * AI included; see tierOf), so the tier names it.
 */
export const planNameKey = (plan: string | null | undefined): StringKey => {
  const tier = tierOf(plan);
  return tier === 'basic' ? 'billing.planBasic' : tier === 'trial' ? 'billing.planTrial' : 'billing.planMonthly';
};
