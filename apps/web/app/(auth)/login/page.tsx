import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to MatricMate to continue your FBISE Class 9 preparation.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  // proxy.ts adds ?next= when it turns away an unauthenticated request, so the
  // student lands where they were going instead of on a generic home screen.
  // The auth callback adds ?error=link when an emailed link fails to verify;
  // without surfacing it, the student sees a normal form and no explanation.
  const { next, error } = await searchParams;
  return <LoginForm next={next} linkFailed={error === 'link'} />;
}
