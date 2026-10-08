import Image from 'next/image';
import { PLAY_URL } from '@/lib/site';

/**
 * Google's own "Get it on Google Play" badge, linking to the app's listing.
 *
 * The artwork is Google's, unaltered (public/brand/google-play-badge.png, the
 * English badge from play.google.com/intl/en_us/badges, with only its
 * transparent margin trimmed). Its rules: never recoloured, redrawn or set
 * smaller than 28px tall, linked only to Google Play, with clear space around
 * it of a quarter of its height, which the places that use it leave. So the
 * hover moves it rather than tinting it.
 *
 * A server component and a plain link: nothing here needs the browser.
 */
export function PlayBadge({ size = 'lg', onDark = false }: { size?: 'lg' | 'sm'; /** On the night-blue bands, where a teal focus ring would not show. */ onDark?: boolean }) {
  const h = size === 'lg' ? 'h-[54px]' : 'h-[44px]';
  const ring = onDark ? 'focus-visible:outline-white' : 'focus-visible:outline-teal';
  return (
    <a
      href={PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex shrink-0 cursor-pointer rounded-[10px] transition-transform duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 ${ring}`}
    >
      <Image src="/brand/google-play-badge.png" alt="Get it on Google Play" width={564} height={168} className={`${h} w-auto`} />
    </a>
  );
}
