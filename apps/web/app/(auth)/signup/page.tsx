import type { Metadata } from 'next';
import { SignUpForm } from '@/components/auth/SignUpForm';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create a free MatricMate account and start preparing for FBISE Class 9 today.',
};

export default function SignUpPage() {
  return <SignUpForm />;
}
