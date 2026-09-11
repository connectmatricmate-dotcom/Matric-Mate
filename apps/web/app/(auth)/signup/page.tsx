import type { Metadata } from 'next';
import { SignUpForm } from '@/components/auth/SignUpForm';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create a free MatricMate account and start preparing for your Class 9 or 10 board exams today.',
};

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string; ref?: string }> }) {
  // proxy.ts adds ?next= when it turns away an unauthenticated request, so the
  // student lands where they were going instead of on a generic home screen.
  // ?ref= is added by /r/CODE, a teacher's referral link.
  const { next, ref } = await searchParams;
  return <SignUpForm next={next} referral={ref} />;
}
