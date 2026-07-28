import type { Metadata } from 'next';
import { ForgotForm } from '@/components/auth/ForgotForm';

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Send yourself a link to reset your MatricMate password.',
};

export default function ForgotPage() {
  return <ForgotForm />;
}
