'use client';

import Link from 'next/link';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Icon } from '@/components/ui/primitives';
import { useT } from '@/lib/store';

export type CertRow = {
  id: string;
  teacher: string;
  title: string | null;
  issued_on: string | null;
};

/**
 * The teacher roster: everyone who reviewed the study material and issued a
 * certificate. Trust material, so it is deliberately plain: real names,
 * real schools, and the certificate itself one click away.
 */
export function CertificatesView({ rows, failed }: { rows: CertRow[]; failed?: boolean }) {
  const t = useT();

  return (
    <Page width="focus">
      <PageHead back="/dashboard" backLabel={t('tabs.home')} title={t('cert.title')} sub={t('cert.sub')} />

      {failed ? (
        <Card className="text-center text-[13.5px] text-ink2">{t('states.errorBody')}</Card>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="text-[34px]">🎓</span>
          <p className="font-display text-[18px] text-ink">{t('cert.emptyTitle')}</p>
          <p className="text-[13px] text-ink2">{t('cert.emptyBody')}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((c) => (
            <Link key={c.id} href={`/certificates/${c.id}`}>
              <Card className="flex items-center gap-4 transition-colors duration-200 hover:border-teal">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-greentint text-[22px]">
                  🎓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-extrabold text-ink">{c.teacher}</span>
                  {c.title ? <span className="block text-[13px] text-ink2">{c.title}</span> : null}
                </span>
                <Icon name="chevron" size={18} className="shrink-0 text-ink3" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
