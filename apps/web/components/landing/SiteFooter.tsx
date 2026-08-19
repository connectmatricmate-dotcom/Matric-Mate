/**
 * Marketing footer. `home` keeps the landing page's in-page anchors; every other
 * marketing page links back to the section on `/`, so a link never dead-ends.
 */
import Image from 'next/image';
import Link from 'next/link';
import { BUSINESS, SUPPORT_EMAIL } from '@matricmate/core';

const PRODUCT = [
  { href: '#inside', label: 'What’s inside' },
  { href: '#papers', label: 'Past papers' },
  { href: '/pricing', label: 'Pricing', absolute: true },
];

export function SiteFooter({ home = false }: { home?: boolean }) {
  const to = (l: (typeof PRODUCT)[number]) => (l.absolute || home ? l.href : `/${l.href}`);

  return (
    <footer className="border-t border-line bg-card">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-5 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[300px]">
          <Image src="/brand/wordmark.png" alt="MatricMate" width={136} height={27} />
          <p className="mt-3 text-mk-small text-ink2">
            Exam preparation for FBISE Class 9, in English and Urdu medium. Built in Pakistan.
          </p>
          {/* The registered office. Rendered only when it is filled in: a blank
              line reads as an oversight, an invented address is worse. */}
          {BUSINESS.address ? (
            <address className="mt-3 not-italic text-mk-small leading-[1.7] text-ink3">
              {BUSINESS.name}
              <br />
              {BUSINESS.address}
              <br />
              {[BUSINESS.city, BUSINESS.country].filter(Boolean).join(', ')}
            </address>
          ) : null}
        </div>
        <div className="flex gap-12">
          <div>
            <p className="text-mk-label font-extrabold uppercase tracking-[0.08em] text-ink3">Product</p>
            <ul className="mt-2.5 flex flex-col gap-2 text-mk-small text-ink2">
              {PRODUCT.map((l) => (
                <li key={l.label}>
                  <Link className="hover:text-teal" href={to(l)}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-mk-label font-extrabold uppercase tracking-[0.08em] text-ink3">Support</p>
            <ul className="mt-2.5 flex flex-col gap-2 text-mk-small text-ink2">
              <li>
                <Link className="hover:text-teal" href={home ? '#faq' : '/#faq'}>
                  FAQ
                </Link>
              </li>
              <li>
                <Link className="hover:text-teal" href="/services">
                  What a plan includes
                </Link>
              </li>
              <li>
                <Link className="hover:text-teal" href="/terms">
                  Terms and conditions
                </Link>
              </li>
              <li>
                <Link className="hover:text-teal" href="/privacy">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link className="hover:text-teal" href="/refunds">
                  Refunds and cancellation
                </Link>
              </li>
              <li>
                <Link className="hover:text-teal" href="/delete-account">
                  Delete your account
                </Link>
              </li>
              <li>
                <a className="hover:text-teal" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
              {BUSINESS.phone ? (
                <li>
                  <a className="hover:text-teal" href={`tel:${BUSINESS.phone.replace(/[^+\d]/g, '')}`}>
                    {BUSINESS.phone}
                  </a>
                </li>
              ) : null}
              <li className="text-ink3">{BUSINESS.hours}</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1100px] px-5 py-4 text-[12.5px] text-ink3">
          © {new Date().getFullYear()} MatricMate
        </p>
      </div>
    </footer>
  );
}
