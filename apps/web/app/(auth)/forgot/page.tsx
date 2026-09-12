import type { Metadata } from 'next';
import { ForgotForm } from '@/components/auth/ForgotForm';

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Send yourself a link to reset your MatricMate password.',
};

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // The auth callback lands here with ?error=expired when a reset link is too
  // old to honour, and ?error=link when it failed for another reason; the form
  // explains which instead of silently starting over.
  const { error } = await searchParams;
  return <ForgotForm linkProblem={error === 'expired' || error === 'link' ? error : undefined} />;
}
