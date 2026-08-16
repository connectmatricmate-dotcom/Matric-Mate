import { Localized } from '@/components/app/Localized';
import { readUiLanguage } from '@/lib/ui-language.server';
import { AppProvider } from '@/lib/store';

/**
 * Checkout mounts the store itself (entitlement refresh after payment, shared
 * copy). It sits outside the (app) group so the Shell chrome stays out of the
 * payment flow, which is why it needs its own provider.
 */
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const lang = await readUiLanguage();
  return (
    <Localized lang={lang}>
      <AppProvider initialLanguage={lang}>{children}</AppProvider>
    </Localized>
  );
}
