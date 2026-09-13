/**
 * Marketing footer. `home` keeps the landing page's in-page anchors; every other
 * marketing page links back to the section on `/`, so a link never dead-ends.
 */
import Link from 'next/link';
import { BUSINESS, SUPPORT_EMAIL } from '@matricmate/core';
import { Wordmark } from '@/components/ui/primitives';

/* 44px rows on a phone, where every one of these is a thumb target; a
   mouse gets the tighter 40px list. */
const LINK = 'inline-flex min-h-11 items-center transition-colors duration-200 hover:text-teal md:min-h-10';

/** Who built the site: a profile link, deliberately without a personal name. */
const DEVELOPER_URL = 'https://www.upwork.com/freelancers/~0193f3975eff0003a8';

const PRODUCT = [
  { href: '#inside', label: 'What’s inside' },
  { href: '#papers', label: 'Past papers' },
  { href: '/pricing', label: 'Pricing', absolute: true },
];

export function SiteFooter({ home = false }: { home?: boolean }) {
  const to = (l: (typeof PRODUCT)[number]) => (l.absolute || home ? l.href : `/${l.href}`);

  return (
    // data-chrome keeps the footer off paper: see the print rules in globals.css.
    <footer data-chrome className="border-t border-line bg-card">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-5 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[300px]">
          <Wordmark />
          <p className="mt-3 text-mk-small text-ink2">
            Exam preparation for FBISE and Punjab Board, Class 9 and 10, in English and Urdu medium. Built in Pakistan.
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
            <ul className="mt-1.5 flex flex-col text-mk-small text-ink2">
              {PRODUCT.map((l) => (
                <li key={l.label}>
                  <Link className={LINK} href={to(l)}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-mk-label font-extrabold uppercase tracking-[0.08em] text-ink3">Support</p>
            <ul className="mt-1.5 flex flex-col text-mk-small text-ink2">
              <li>
                <Link className={LINK} href={home ? '#faq' : '/#faq'}>
                  FAQ
                </Link>
              </li>
              <li>
                <Link className={LINK} href="/services">
                  What a plan includes
                </Link>
              </li>
              <li>
                <Link className={LINK} href="/terms">
                  Terms and conditions
                </Link>
              </li>
              <li>
                <Link className={LINK} href="/privacy">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link className={LINK} href="/refunds">
                  Refunds and cancellation
                </Link>
              </li>
              <li>
                <Link className={LINK} href="/delete-account">
                  Delete your account
                </Link>
              </li>
              <li>
                <a className={`${LINK} wrap-anywhere`} href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
              {BUSINESS.phone ? (
                <li>
                  <a className={`${LINK} wrap-anywhere`} href={`tel:${BUSINESS.phone.replace(/[^+\d]/g, '')}`}>
                    {BUSINESS.phone}
                  </a>
                </li>
              ) : null}
              <li className="pt-1.5 text-ink3">{BUSINESS.hours}</li>
            </ul>
          </div>
        </div>
      </div>
      {/* Copyright on the left, the developer credit on the right; on a phone
          the credit wraps to its own line under the copyright. */}
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-6 px-5 py-2 text-[12.5px] text-ink3">
          <p className="py-2">© {new Date().getFullYear()} MatricMate</p>
          <p>
            Developed by{' '}
            <a
              className={`${LINK} text-ink2`}
              href={DEVELOPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Developed by a freelancer on Upwork (opens in a new tab)"
            >
              a freelancer on Upwork
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
