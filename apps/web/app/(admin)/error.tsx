'use client';

import { StaffError } from '@/components/staff/StaffError';

/** Catches a crash inside any admin screen while the shell around it survives. */
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <StaffError {...props} what="This page" />;
}
