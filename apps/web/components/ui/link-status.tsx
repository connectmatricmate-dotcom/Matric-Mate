'use client';

/**
 * Pending affordances for Link-based navigation.
 *
 * useLinkStatus reads the status of the nearest ancestor <Link>, so these are
 * tiny client leaves that sit INSIDE server-rendered links (LinkBtn, Item).
 * While the navigation is in flight they swap themselves for a spinner, which
 * is what stops a slow route transition from reading as a dead tap. Outside a
 * Link they report not-pending and render their idle state, so they are safe
 * anywhere.
 */
import { useLinkStatus } from 'next/link';
import type { IconName } from '@matricmate/core';
import { Icon } from './primitives';

/** The icon slot of a LinkBtn: its own icon normally, a spinner while navigating. */
export function LinkBtnIcon({ icon, size }: { icon?: IconName; size: number }) {
  const { pending } = useLinkStatus();
  if (pending) return <Icon name="refresh" size={size} className="animate-spin" />;
  return icon ? <Icon name={icon} size={size} /> : null;
}

/** The chevron of a link row: points forward normally, spins while navigating. */
export function NavChevron({ size = 18, className = 'text-ink3' }: { size?: number; className?: string }) {
  const { pending } = useLinkStatus();
  return <Icon name={pending ? 'refresh' : 'chevron'} size={size} className={`${className} ${pending ? 'animate-spin' : ''}`} />;
}
