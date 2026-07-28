/**
 * A payment brand's symbol at a fixed size, so JazzCash's round mark and
 * Easypaisa's wider "e" sit on the same optical baseline in a list. Card has no
 * third-party asset, so it falls back to our own icon.
 */
import Image from 'next/image';
import { Icon } from '@/components/ui/primitives';

export function PayMark({ logo, label, size = 28 }: { logo: string | null; label: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[9px] bg-white"
      style={{ width: size + 12, height: size + 12 }}
    >
      {logo ? (
        <Image src={logo} alt="" width={size} height={size} className="object-contain" style={{ width: size, height: size }} />
      ) : (
        <Icon name="card" size={size - 6} className="text-ink2" aria-label={label} />
      )}
    </span>
  );
}
