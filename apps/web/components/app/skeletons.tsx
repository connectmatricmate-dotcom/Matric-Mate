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
  /* The line boxes of PageHead's eyebrow (11.5px), title (26px at 1.15) and
     sub (14px), with its own 2px and 4px gaps, so the header arrives without
     moving the page. The back link is a 44px row with a short label in it. */
  return (
    <div className="mb-5">
      {back ? (
        <div className="mb-1 flex h-11 items-center">
          <Skeleton className="h-4 w-24" />
        </div>
      ) : null}
      <Skeleton className="h-[17px] w-32" />
      <Skeleton className="mt-0.5 h-[30px] w-64 max-w-full" />
      <Skeleton className="mt-1 h-[21px] w-44 max-w-full" />
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

/**
 * A card of list rows, for a list a screen reads in the browser: recent
 * chats, the inbox. Shaped like Item inside `Card flat py-0`, so the rows
 * land where the bars were.
 */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card flat className="py-0">
      {Array.from({ length: rows }, (_, i) => (
        <RowSkeleton key={i} last={i === rows - 1} />
      ))}
    </Card>
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

/** /session/papers: a year heading over a card of rows, twice. */
export function PapersSkeleton() {
  return (
    <Page>
      <PageHeadSkeleton />
      {[0, 1].map((g) => (
        <div key={g} className="mt-6 first:mt-0">
          <Skeleton className="mb-2 h-4 w-28" />
          <Card flat className="py-0">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton last />
          </Card>
        </div>
      ))}
    </Page>
  );
}

/** /session/topper-papers: an intro card over a grid of subject cards. */
export function TopperPapersSkeleton() {
  return (
    <Page>
      <PageHeadSkeleton />
      <Card flat className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-[12px]" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3.5 w-full max-w-md" />
          <Skeleton className="mt-2 h-3.5 w-3/4 max-w-md" />
        </div>
      </Card>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Card flat key={i} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-[46px] w-[46px] shrink-0 rounded-[14px]" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-28 max-w-full" />
                <Skeleton className="mt-1.5 h-3 w-16 max-w-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20 rounded-[16px]" />
              <Skeleton className="h-9 w-20 rounded-[16px]" />
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

/**
 * /session/flashcards: shaped like FlashcardsScreen, which opens on a
 * SessionHeader (back, progress and its label, the chapter pill) rather than
 * a PageHead, then the card, the two counts and two full-width buttons.
 */
export function FlashcardsSkeleton() {
  return (
    <Page width="focus">
      <div className="flex items-center gap-2.5 pt-1">
        <Skeleton className="h-11 w-11 shrink-0 rounded-[14px]" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-[7px] w-full rounded-full" />
          <Skeleton className="mt-1.5 h-3 w-32 max-w-full" />
        </div>
        <Skeleton className="h-[26px] w-20 shrink-0 rounded-full" />
      </div>
      <Skeleton className="mt-6 h-[320px] w-full rounded-[22px]" />
      <div className="mt-4 flex justify-center gap-2">
        <Skeleton className="h-[26px] w-24 rounded-full" />
        <Skeleton className="h-[26px] w-24 rounded-full" />
      </div>
      <div className="mt-6 flex gap-2.5">
        <Skeleton className="h-[55px] flex-1 rounded-[16px]" />
        <Skeleton className="h-[55px] flex-1 rounded-[16px]" />
      </div>
    </Page>
  );
}

/**
 * The in-session screens: the SessionHeader row (back, segments and their
 * label, the chapter pill), the question, then the answer area in the shape
 * the screen really has. `kind` picks it: four option bars for MCQs and the
 * timed test, an answer box for short questions, a row of chips for blanks.
 * The option bars used to stand in for all three, then vanish.
 */
export function QuestionSkeleton({ kind = 'mcq' }: { kind?: 'mcq' | 'shortq' | 'blanks' }) {
  return (
    <Page width="focus">
      <div className="flex items-center gap-2.5 pt-1">
        <Skeleton className="h-11 w-11 shrink-0 rounded-[14px]" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-[7px] w-full rounded-full" />
          <Skeleton className="mt-1.5 h-3 w-32 max-w-full" />
        </div>
        <Skeleton className="h-[26px] w-20 shrink-0 rounded-full" />
      </div>
      <Skeleton className="mt-6 h-6 w-11/12" />
      <Skeleton className="mt-2 h-6 w-3/4" />
      {kind === 'shortq' ? (
        <Skeleton className="mt-6 h-32 w-full rounded-[16px]" />
      ) : kind === 'blanks' ? (
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Skeleton className="h-11 w-24 rounded-full" />
          <Skeleton className="h-11 w-28 rounded-full" />
          <Skeleton className="h-11 w-20 rounded-full" />
          <Skeleton className="h-11 w-24 rounded-full" />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2.5">
          <Skeleton className="h-14 w-full rounded-[15px]" />
          <Skeleton className="h-14 w-full rounded-[15px]" />
          <Skeleton className="h-14 w-full rounded-[15px]" />
          <Skeleton className="h-14 w-full rounded-[15px]" />
        </div>
      )}
    </Page>
  );
}

/**
 * /tutor/chat: the chat owns the viewport (see ChatScreen), a header strip,
 * the conversation and the composer pinned under it. The generic page
 * skeleton drew a page heading and a list at page width, then the column
 * replaced it at a different width and height.
 */
export function ChatSkeleton() {
  return (
    <div className="-mx-4 -mb-28 -mt-6 flex h-[calc(100dvh-3.5rem-58px-env(safe-area-inset-bottom))] flex-col md:-mx-8 md:-mb-16 md:h-[calc(100dvh-3.5rem)]">
      <div className="border-b border-line bg-paper px-4 py-2 md:px-8">
        <div className="mx-auto flex w-full max-w-[820px] items-center gap-2.5">
          <Skeleton className="h-11 w-11 shrink-0 rounded-[14px]" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-40 max-w-full" />
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 px-4 md:px-8">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4 py-5">
          <Skeleton className="h-14 w-3/4 self-end" />
          <Skeleton className="h-28 w-[85%] self-start" />
        </div>
      </div>
      <div className="border-t border-line bg-card px-4 py-3 md:px-8">
        <div className="mx-auto flex w-full max-w-[820px] items-center gap-2.5">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <Skeleton className="h-11 min-w-0 flex-1 rounded-full" />
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        </div>
      </div>
    </div>
  );
}
