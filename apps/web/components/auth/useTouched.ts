'use client';

import { type FocusEvent, useCallback, useState } from 'react';

/**
 * Which fields somebody has left, so each field's error shows once they move
 * on from it, not while they are still typing into it.
 *
 * The auth forms used to reveal their errors on submit. The submit button
 * stays disabled until the form is valid, so that submit never came: a
 * greyed-out button and no word on why. One listener on the form covers every
 * field, since React's blur bubbles, and the field's `name` says which it was.
 */
export function useTouched() {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const onBlur = useCallback((e: FocusEvent<HTMLFormElement>) => {
    const name = (e.target as { name?: unknown }).name;
    if (typeof name === 'string' && name) setTouched((t) => (t[name] ? t : { ...t, [name]: true }));
  }, []);
  return { touched, onBlur };
}
