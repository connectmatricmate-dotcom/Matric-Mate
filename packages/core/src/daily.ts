import { translate, type Language } from './i18n';
import type { SyncClient } from './sync';

/**
 * The day's report and the clock that feeds it (migration 0042).
 *
 * The client asked for two things nothing recorded: whether a student opened
 * the app on a day and for how long, and a report of that one day next to the
 * monthly card. The database keeps both, per Karachi day; this is what each
 * app reads and writes, so the phone and the website count the same minutes
 * and show the same day.
 */

/** One Karachi day, as `daily_report` returns it. */
export type DailyReport = {
  /** YYYY-MM-DD, in Pakistan. */
  day: string;
  /** The app was open at some point that day. */
  opened: boolean;
  /** Seconds the app was open and in use. */
  seconds: number;
  /** The day counts towards the streak. */
  studied: boolean;
  questions: number;
  correct: number;
  subjects: { subject: string; questions: number; correct: number }[];
  /** Note sections read. */
  sections: number;
  /** Flashcards marked known. */
  cards: number;
  tests: { label: string; score: number; total: number }[];
  /** Chapters worked in, by id. */
  chapters: string[];
};

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

/** The report from the RPC's JSON, or null when it is not one. */
export function parseDailyReport(raw: unknown): DailyReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.day !== 'string') return null;
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    day: r.day,
    opened: !!r.opened,
    seconds: num(r.seconds),
    studied: !!r.studied,
    questions: num(r.questions),
    correct: num(r.correct),
    subjects: list(r.subjects).map((s: Record<string, unknown>) => ({
      subject: String(s.subject ?? ''),
      questions: num(s.questions),
      correct: num(s.correct),
    })),
    sections: num(r.sections),
    cards: num(r.cards),
    tests: list(r.tests).map((x: Record<string, unknown>) => ({ label: String(x.label ?? ''), score: num(x.score), total: num(x.total) })),
    chapters: list(r.chapters).filter((c): c is string => typeof c === 'string'),
  };
}

/**
 * A day in Pakistan, `back` days before today, as YYYY-MM-DD.
 *
 * The database keys every day on Karachi time, and so must the day a screen
 * asks for, or a student abroad, or a phone with its zone set wrong, would
 * ask for yesterday and be shown it as today.
 */
export function karachiDay(back = 0, now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(now - back * 864e5));
}

/** One day's report for the signed-in student; `day` defaults to today. Null when the read failed. */
export async function fetchDailyReport(client: SyncClient, day?: string): Promise<DailyReport | null> {
  if (!client.rpc) return null;
  try {
    const { data, error } = await client.rpc('daily_report', day ? { p_day: day } : {});
    if (error) return null;
    return parseDailyReport(data);
  } catch {
    return null;
  }
}

/** Whole minutes and hours in a stretch of seconds, for the "1 h 20 min" a screen prints. */
export function studyTimeParts(seconds: number): { h: number; m: number } {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}

/** "1 h 20 min", "35 min", "Under a minute", in the student's language. */
export function studyTimeLabel(seconds: number, lang: Language): string {
  const { h, m } = studyTimeParts(seconds);
  if (h) return translate(lang, 'today.hoursMinutes', { h, m });
  if (m) return translate(lang, 'today.minutes', { n: m });
  return seconds > 0 ? translate(lang, 'today.lessThanMinute') : translate(lang, 'today.minutes', { n: 0 });
}

/**
 * Minutes of use, sent a minute at a time.
 *
 * Each app decides what counts as a minute of use (the screen in view and a
 * touch or an audio lesson in the last ten minutes) and calls `minute()`; this
 * only makes sure the seconds reach `add_study_time` and are not lost to a
 * dropped connection. The server takes at most two minutes a call, so a
 * backlog goes up in pieces. It is kept to two hours: past that, a phone that
 * has been offline all day would pour the lot into whichever day it next
 * reaches the internet on.
 */
export class StudyClock {
  private pending = 0;
  private busy = false;
  private markOpen = false;

  constructor(private readonly client: SyncClient) {}

  /** The app came into view: records today as a day it was opened. */
  opened(): void {
    this.markOpen = true;
    void this.flush();
  }

  /** A minute of use. */
  minute(): void {
    this.pending = Math.min(this.pending + 60, 7200);
    void this.flush();
  }

  private async send(seconds: number): Promise<boolean> {
    if (!this.client.rpc) return false;
    try {
      const { error } = await this.client.rpc('add_study_time', { p_seconds: seconds });
      return !error;
    } catch {
      return false;
    }
  }

  private async flush(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.pending > 0 || this.markOpen) {
        const chunk = Math.min(this.pending, 120);
        if (!(await this.send(chunk))) break;
        this.pending -= chunk;
        this.markOpen = false;
      }
    } finally {
      this.busy = false;
    }
  }
}
