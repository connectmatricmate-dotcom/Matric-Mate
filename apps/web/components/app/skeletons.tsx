/**
 * Shape-matched skeletons for every route that fetches before it renders.
 *
 * One composition per screen, built from the single Skeleton primitive, sized
 * against the real components (Card p-4, item rows py-3.5 with a 42px chip,
 * PageHead's 26/30px title) so nothing shifts when content arrives. Server-safe
 * on purpose: loading.tsx files render these during the RSC round trip.
 */
import { Page, Rail, Split, Work } from '@/components/app/Page';
import { Card, Skeleton } from '@/components/ui/primitives';

export function PageHeadSkeleton({ back }: { back?: boolean }) {
  return (
    <div className="mb-5">
      {back ? <Skeleton className="mb-2 h-4 w-24" /> : null}
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-2 h-8 w-64 max-w-full" />
      <Skeleton className="mt-2 h-4 w-44 max-w-full" />
    </div>
  );
}

/** One list row: 42px chip, title line, sub line. Matches ItemBody. */
function RowSkeleton({ last }: { last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-3.5 ${last ? '' : 'border-b border-line'}`}>
      <Skeleton className="h-[42px] w-[42px] shrink-0 rounded-[13px]" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="mt-1.5 h-3 w-56 max-w-full" />
      </div>
    </div>
  );
}

function RailCardSkeleton() {
  return (
    <Card flat>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2.5 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-3/4" />
    </Card>
  );
}

/** Generic app page: heading plus a card of rows. The (app) route-group fallback. */
export function AppPageSkeleton() {
  return (
    <Page>
      <PageHeadSkeleton />
      <Card flat className="py-0">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton last />
      </Card>
    </Page>
  );
}

/** /learn/subject/[id]: chapter cards in the work column, ring card in the rail. */
export function ChapterListSkeleton() {
  return (
    <Page>
      <PageHeadSkeleton back />
      <Split>
        <Work className="flex flex-col gap-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Card flat key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-[12px]" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="mt-1.5 h-3 w-64 max-w-full" />
              </div>
            </Card>
          ))}
        </Work>
        <Rail>
          <Card flat className="flex items-center gap-4">
            <Skeleton className="h-[68px] w-[68px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-1.5 h-3 w-32" />
            </div>
          </Card>
          <RailCardSkeleton />
        </Rail>
      </Split>
    </Page>
  );
}

/** /learn/chapter/[id]: the six-row section card plus the progress rail. */
export function ChapterHubSkeleton() {
  return (
    <Page>
      <PageHeadSkeleton back />
      <Split>
        <Work>
          <Skeleton className="mb-2 h-3 w-20" />
          <Card flat className="py-0">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton last />
          </Card>
        </Work>
        <Rail>
          <Card flat className="flex items-center gap-4">
            <Skeleton className="h-[68px] w-[68px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-1.5 h-3 w-32" />
            </div>
          </Card>
          <RailCardSkeleton />
        </Rail>
      </Split>
    </Page>
  );
}

/** /learn/reader/[id]: prose at read width. */
export function ReaderSkeleton() {
  return (
    <Page width="read">
      <PageHeadSkeleton back />
      <Card flat>
        <Skeleton className="h-5 w-56 max-w-full" />
        <div className="mt-4 flex flex-col gap-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Card>
    </Page>
  );
}

/** /learn/audio/[id]: one player card. */
export function AudioSkeleton() {
  return (
    <Page width="focus">
      <PageHeadSkeleton back />
      <Card flat className="flex flex-col items-center py-8">
        <Skeleton className="h-[130px] w-[130px] rounded-[16px]" />
        <Skeleton className="mt-5 h-5 w-48 max-w-full" />
        <Skeleton className="mt-2 h-3 w-32" />
        <Skeleton className="mt-6 h-2 w-full max-w-[420px] rounded-full" />
        <div className="mt-5 flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-11 w-11 rounded-full" />
        </div>
      </Card>
    </Page>
  );
}

/** /session/papers: filter chips over a card grid. */
export function PapersSkeleton() {
  return (
    <Page>
      <PageHeadSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-20 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Card flat key={i}>
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="mt-2 h-3 w-56 max-w-full" />
            <Skeleton className="mt-4 h-9 w-28 rounded-[16px]" />
          </Card>
        ))}
      </div>
    </Page>
  );
}

/** /session/flashcards: the single big card plus its controls. */
export function FlashcardsSkeleton() {
  return (
    <Page width="focus">
      <PageHeadSkeleton back />
      <Skeleton className="h-[320px] w-full rounded-[16px]" />
      <div className="mt-5 flex justify-center gap-2.5">
        <Skeleton className="h-11 w-32 rounded-[16px]" />
        <Skeleton className="h-11 w-32 rounded-[16px]" />
      </div>
    </Page>
  );
}

/** /session/shortq and /session/blanks: progress row, prompt, answer area. */
export function QuestionSkeleton() {
  return (
    <Page width="focus">
      <div className="flex items-center gap-2.5 pt-1">
        <Skeleton className="h-10 w-10 rounded-[13px]" />
        <Skeleton className="h-2 flex-1 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-6 h-6 w-11/12" />
      <Skeleton className="mt-2 h-6 w-3/4" />
      <div className="mt-6 flex flex-col gap-2.5">
        <Skeleton className="h-14 w-full rounded-[15px]" />
        <Skeleton className="h-14 w-full rounded-[15px]" />
        <Skeleton className="h-14 w-full rounded-[15px]" />
        <Skeleton className="h-14 w-full rounded-[15px]" />
      </div>
    </Page>
  );
}
