'use client';

import { formatDate } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Label } from '@/components/ui/primitives';
import { useLang, useT } from '@/lib/store';

export type CertDetailRow = {
  id: string;
  teacher: string;
  title: string | null;
  bio: string | null;
  image_url: string;
  issued_on: string | null;
};

/**
 * One teacher, one certificate. The picture is the point: it renders at its
 * own aspect ratio, full width, inside a plain frame, because a trust
 * document should look like a document and not like app chrome.
 */
export function CertificateDetail({ cert }: { cert: CertDetailRow }) {
  const t = useT();
  const { lang } = useLang();

  return (
    <Page width="focus">
      <PageHead back="/certificates" backLabel={t('cert.title')} title={cert.teacher} sub={cert.title ?? undefined} />

      <Card>
        {cert.issued_on ? (
          <p className="text-[13px] text-ink2">
            {t('cert.issued', {
              date: formatDate(cert.issued_on, lang, { day: 'numeric', month: 'long', year: 'numeric' }),
            })}
          </p>
        ) : null}
        {cert.bio ? <p className="mt-2 text-[13.5px] leading-[1.6] text-ink2">{cert.bio}</p> : null}
      </Card>

      <div className="mt-4">
        <Label>{t('cert.viewCertificate')}</Label>
        <div className="mt-2 overflow-hidden rounded-[16px] border border-line bg-card">
          {/* Plain img, not next/image: certificate files live in Supabase
              storage at arbitrary sizes and the trust document should render
              exactly as issued. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cert.image_url} alt={`${cert.teacher} · ${t('cert.viewCertificate')}`} className="h-auto w-full" />
        </div>
      </div>
    </Page>
  );
}
