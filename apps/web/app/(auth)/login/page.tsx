import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to MatricMate to continue your FBISE Class 9 preparation.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // proxy.ts adds ?next= when it turns away an unauthenticated request, so the
  // student lands where they were going instead of on a generic home screen.
  const { next } = await searchParams;
  return <LoginForm next={next} />;
}
