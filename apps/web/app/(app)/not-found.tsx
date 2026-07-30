import { Card, Icon, LinkBtn } from '@/components/ui/primitives';

/**
 * A bad chapter or paper id lands here INSIDE the Shell, so the student keeps
 * the nav and a route back into Study instead of being dropped on a bare page.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[520px] items-center px-5">
      <Card className="w-full text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tealtint text-teal">
          <Icon name="search" size={26} />
        </span>
        <h1 className="mt-3 font-display text-[22px] text-ink">We couldn&rsquo;t find that</h1>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-ink2">
          That chapter or page doesn&rsquo;t exist. It may have moved, or the link has a typo.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <LinkBtn title="Browse subjects" href="/study" />
          <LinkBtn title="Go to Home" href="/dashboard" variant="line" />
        </div>
      </Card>
    </main>
  );
}
