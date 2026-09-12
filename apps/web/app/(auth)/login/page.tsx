import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';
import { canonicalUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to MatricMate to continue your exam preparation.',
  alternates: { canonical: canonicalUrl('/login') },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  // proxy.ts adds ?next= when it turns away an unauthenticated request, so the
  // student lands where they were going instead of on a generic home screen.
  // The email-link handlers add ?error=link when a link fails to verify, and
  // /auth/confirm adds ?error=expired for one already used or out of date;
  // without surfacing either, the student sees a normal form and no reason.
  const { next, error } = await searchParams;
  return <LoginForm next={next} linkFailed={error === 'link' || error === 'expired'} />;
}
