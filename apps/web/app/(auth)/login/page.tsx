import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Log in to MatricMate to continue your FBISE Class 9 preparation.',
};

export default function LoginPage() {
  return <LoginForm />;
}
