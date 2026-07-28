import type { Metadata } from 'next';
import { SettingsView } from '@/components/screens/SettingsView';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Language, study medium, reading size, reminders and storage.',
};

export default function SettingsPage() {
  return <SettingsView />;
}
