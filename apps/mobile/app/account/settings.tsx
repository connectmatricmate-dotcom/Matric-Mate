import { useEffect } from 'react';
import { router } from 'expo-router';

/**
 * Settings and Account merged into one screen (the client found two
 * destinations confusing). Everything lives at /account now; this route
 * survives only so old links and habits still land somewhere sensible.
 */
export default function SettingsRedirect() {
  useEffect(() => {
    router.replace('/account');
  }, []);
  return null;
}
