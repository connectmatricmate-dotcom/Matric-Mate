import { Card, Icon, LinkBtn } from '@/components/ui/primitives';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[520px] items-center px-5">
      <Card className="w-full text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tealtint text-teal">
          <Icon name="search" size={26} />
        </span>
        <h1 className="mt-3 font-display text-[22px] text-ink">Page not found</h1>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-ink2">
          That link doesn’t point anywhere. It may have moved, or the address has a typo.
        </p>
        <div className="mt-5 flex justify-center">
          <LinkBtn title="Go to the homepage" href="/" />
        </div>
      </Card>
    </main>
  );
}
