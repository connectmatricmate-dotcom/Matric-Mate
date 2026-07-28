/**
 * The app's state lives outside React and components subscribe to it.
 *
 * Why not `useState` + a hydrate effect: reading localStorage on the server is
 * impossible, so the naive version renders empty, then calls setState in an
 * effect — a cascading render, and exactly what `react-hooks/set-state-in-effect`
 * warns about. An external store with `useSyncExternalStore` is the supported
 * shape for this: the server snapshot is empty, the client snapshot is whatever
 * was saved, and React reconciles without a second render pass.
 *
 * The state shape matches the Android app's store deliberately — see
 * apps/mobile/src/store/app.tsx.
 */
import { AI_QUOTA, Attempt, ChatThread, Language, Medium, Group, Notification, TestResult, XP, todayKey } from '@matricmate/core';

const KEY = 'mm.web.v1';

export type Onboarding = {
  classLevel: 9 | 10;
  board: 'fbise' | 'punjab';
  medium: Medium;
  group: Group;
  subjects: string[];
};

export type Settings = {
  language: Language;
  reminders: boolean;
  reminderTime: string;
  streakAlerts: boolean;
  contentMedium: Medium;
  fontScale: 0 | 1 | 2;
};

export type State = {
  user: { id: string; name: string; contact: string } | null;
  onboarding: Onboarding | null;
  premium: { active: boolean; validTill: number | null; ref?: string };
  readSections: string[];
  attempts: Attempt[];
  results: TestResult[];
  planDone: string[];
  downloads: string[];
  ai: { day: string; used: number };
  threads: ChatThread[];
  notifications: Notification[];
  settings: Settings;
  lastChapterId?: string;
  lastSectionIndex: number;
  activeDays: string[];
  xp: number;
  cardsKnown: string[];
  /** False until the saved snapshot has been read, so the UI can hold off. */
  hydrated: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  reminders: true,
  reminderTime: '7:00 PM',
  streakAlerts: true,
  contentMedium: 'en',
  fontScale: 1,
};

/** Stable reference — `useSyncExternalStore` requires the server snapshot not to change identity. */
export const EMPTY: State = {
  user: null,
  onboarding: null,
  premium: { active: false, validTill: null },
  readSections: [],
  attempts: [],
  results: [],
  planDone: [],
  downloads: [],
  ai: { day: todayKey(), used: 0 },
  threads: [],
  notifications: [],
  settings: DEFAULT_SETTINGS,
  lastSectionIndex: 0,
  activeDays: [],
  xp: 0,
  cardsKnown: [],
  hydrated: false,
};

let state: State = EMPTY;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getSnapshot = () => state;
export const getServerSnapshot = () => EMPTY;

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // storage blocked or full — the session still works in memory
    }
  }, 250);
}

export function update(fn: (s: State) => State) {
  state = fn(state);
  listeners.forEach((l) => l());
  if (typeof window !== 'undefined' && state.hydrated) persist();
}

/** Reads the saved snapshot once, on the client. Safe to call repeatedly. */
export function hydrate() {
  if (state.hydrated) return;
  let restored: State = { ...EMPTY, hydrated: true };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      restored = {
        ...EMPTY,
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        hydrated: true,
      };
    }
  } catch {
    // corrupt snapshot — start clean rather than crash
  }
  state = restored;
  listeners.forEach((l) => l());
}

/** Marks today active; used by anything that counts as studying. */
export function touchToday(s: State): State {
  const t = todayKey();
  return s.activeDays.includes(t) ? s : { ...s, activeDays: [...s.activeDays, t] };
}

export const aiLimitFor = (premium: boolean) => (premium ? AI_QUOTA.premium : AI_QUOTA.free);
export const xpFor = XP.forAnswer;
