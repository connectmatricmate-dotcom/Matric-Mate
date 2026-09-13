'use client';

/**
 * The four onboarding steps share one frame: a heading, a progress row, the
 * choices, and a single forward action. Mirrors
 * apps/mobile/src/components/OnboardingStep.tsx so the two apps read the same.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { canGoBack } from '@/lib/nav-trail';
import { useTransition } from 'react';
import { Btn } from '@/components/ui/controls';
import { Card, Check, Icon, Pill, Ur } from '@/components/ui/primitives';
import { useT } from '@/lib/store';

export function Steps({ step, total = 4 }: { step: number; total?: number }) {
  const t = useT();
  return (
    <ol className="mb-6 flex justify-center gap-1.5" aria-label={t('onboarding.stepOf', { n: step, total })}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <li
          key={n}
          aria-current={n === step ? 'step' : undefined}
          className={`h-2 rounded-full transition-all duration-200 ${n === step ? 'w-[22px]' : 'w-2'} ${
            n <= step ? 'bg-teal' : 'bg-mute'
          }`}
        />
      ))}
    </ol>
  );
}

export function ChoiceCard({
  title,
  sub,
  urduTitle,
  selected,
  disabled,
  disabledLabel,
  onClick,
  round = true,
}: {
  title: string;
  sub?: string;
  urduTitle?: string;
  selected?: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  onClick?: () => void;
  round?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={disabled ? undefined : !!selected}
      aria-disabled={disabled || undefined}
      className={`w-full text-start transition-transform duration-200 ease-out ${
        disabled ? 'opacity-55' : 'active:scale-[0.99]'
      }`}
    >
      <Card
        flat={!selected}
        tint={selected ? 'bg-tealtint' : undefined}
        border={selected ? 'border-teal' : undefined}
        className={`flex items-center gap-3 ${disabled ? '' : 'hover:border-teal'}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] text-ink">{title}</span>
          {urduTitle ? <Ur block className="mt-0.5 block text-[16px]">{urduTitle}</Ur> : null}
          {sub ? <span className="mt-0.5 block text-[13px] text-ink2">{sub}</span> : null}
        </span>
        {disabled ? <Pill tone="grey">{disabledLabel}</Pill> : <Check on={!!selected} round={round} />}
      </Card>
    </button>
  );
}

export function StepScreen({
  step,
  title,
  sub,
  children,
  cta,
  onNext,
  disabled,
  waiting,
  footnote,
  backHref,
  edit,
}: {
  step: number;
  title: string;
  sub: string;
  children: React.ReactNode;
  cta: string;
  /** May be async: the button keeps spinning until it settles. */
  onNext: () => void | Promise<void>;
  disabled?: boolean;
  /**
   * The account's saved setup is still being read. The button waits with it:
   * pressed now, it would save the defaults on screen over the choices the
   * account already has.
   */
  waiting?: boolean;
  footnote?: string;
  /**
   * Where Back goes. A real address rather than the browser's history, which
   * after a hard load or a link from an email is some other site, or nothing.
   */
  backHref?: string;
  /** Opened from Edit profile: Back is history back, to the profile. */
  edit?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  // Every step's forward action is a save plus a route push. The button spins
  // until the next step paints, otherwise a slow transition reads as a dead
  // tap and invites a second click.
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto w-full max-w-[540px] px-5 py-7">
      {backHref ? (
        <Link
          href={backHref}
          replace={!edit}
          /* First run: the steps replace one another, so the whole setup is
             one history entry and finishing it leaves nothing for the
             browser's back button to reopen. From Edit profile: back to the
             profile itself, wherever it is behind. */
          onClick={(e) => {
            if (!edit || !canGoBack() || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            router.back();
          }}
          className="-ms-1 mb-4 inline-flex min-h-11 items-center gap-1.5 pe-2 text-[13.5px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
        >
          <Icon name="chevron" size={18} className="rotate-180" />
          {t('common.back')}
        </Link>
      ) : null}

      <h1 className="font-display text-[26px] leading-tight text-ink rtl:leading-[1.9]">{title}</h1>
      <p className="mb-5 mt-1 text-[14.5px] text-ink2">{sub}</p>

      <Steps step={step} />

      <div className="flex flex-col gap-3">{children}</div>

      {footnote ? <p className="mt-6 text-[12.5px] text-ink2">{footnote}</p> : null}

      <div className="mt-7">
        <Btn
          title={cta}
          onClick={() =>
            startTransition(async () => {
              await onNext();
            })
          }
          disabled={disabled}
          loading={pending || waiting}
          className="w-full"
        />
      </div>
    </div>
  );
}
