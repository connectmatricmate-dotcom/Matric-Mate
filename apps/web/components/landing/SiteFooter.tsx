/**
 * Marketing footer. `home` keeps the landing page's in-page anchors; every other
 * marketing page links back to the section on `/`, so a link never dead-ends.
 */
import Image from 'next/image';
import Link from 'next/link';

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
          <Image src="/brand/wordmark.png" alt="MatricMate" width={140} height={28} />
          <p className="mt-3 text-[13px] leading-[1.6] text-ink2">
            Exam preparation for FBISE Class 9, in English and Urdu medium. Built in Pakistan.
          </p>
        </div>
        <div className="flex gap-12">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink3">Product</p>
            <ul className="mt-2.5 flex flex-col gap-2 text-[13.5px] text-ink2">
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
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink3">Support</p>
            <ul className="mt-2.5 flex flex-col gap-2 text-[13.5px] text-ink2">
              <li>
                <Link className="hover:text-teal" href={home ? '#faq' : '/#faq'}>
                  FAQ
                </Link>
              </li>
              <li>
                <Link className="hover:text-teal" href="/terms">
                  Terms and privacy
                </Link>
              </li>
              <li>WhatsApp · 10am–10pm</li>
              <li>help@matricmate.pk</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1100px] px-5 py-4 text-[12px] text-ink3">
          © {new Date().getFullYear()} MatricMate · Prototype build with sample content
        </p>
      </div>
    </footer>
  );
}
