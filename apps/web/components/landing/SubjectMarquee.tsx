/**
 * The Class 9 syllabus, scrolling past.
 *
 * Server component: the movement is a CSS animation, so this ships no
 * JavaScript. The list is rendered twice because a marquee only loops
 * seamlessly if the second copy is already in place when the first scrolls
 * out. The duplicate is hidden from screen readers, which should hear the
 * subjects once.
 */
import { Icon } from '@/components/ui';
import type { IconName } from '@matricmate/core';

const SUBJECTS: { icon: IconName; label: string }[] = [
  { icon: 'phy', label: 'Physics' },
  { icon: 'chem', label: 'Chemistry' },
  { icon: 'bio', label: 'Biology' },
  { icon: 'math', label: 'Mathematics' },
  { icon: 'eng', label: 'English' },
  { icon: 'urd', label: 'Urdu' },
  { icon: 'isl', label: 'Islamiat' },
  { icon: 'pst', label: 'Pakistan Studies' },
  { icon: 'cs', label: 'Computer Science' },
];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <div aria-hidden={hidden}>
      {SUBJECTS.map((s) => (
        <span
          key={s.label}
          className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[13.5px] font-extrabold text-tealtint"
        >
          <Icon name={s.icon} size={15} className="text-cyan" />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function SubjectMarquee() {
  return (
    <div className="marquee">
      <Row />
      <Row hidden />
    </div>
  );
}
