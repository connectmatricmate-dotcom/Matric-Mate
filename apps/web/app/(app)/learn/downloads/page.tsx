import type { Metadata } from 'next';
import { DownloadsView } from '@/components/screens/DownloadsView';

export const metadata: Metadata = {
  title: 'Downloads',
  description: 'Chapters saved for studying without internet.',
};

export default function DownloadsPage() {
  return <DownloadsView />;
}
