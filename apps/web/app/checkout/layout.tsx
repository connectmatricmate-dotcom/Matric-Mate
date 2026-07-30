import { AppProvider } from '@/lib/store';

/**
 * Checkout mounts the store itself (entitlement refresh after payment, shared
 * copy). It sits outside the (app) group so the Shell chrome stays out of the
 * payment flow, which is why it needs its own provider.
 */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
