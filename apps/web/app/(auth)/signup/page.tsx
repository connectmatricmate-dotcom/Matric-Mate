import type { Metadata } from 'next';
import { SignUpForm } from '@/components/auth/SignUpForm';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create a free MatricMate account and start preparing for FBISE Class 9 today.',
};

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // proxy.ts adds ?next= when it turns away an unauthenticated request, so the
  // student lands where they were going instead of on a generic home screen.
  const { next } = await searchParams;
  return <SignUpForm next={next} />;
}
