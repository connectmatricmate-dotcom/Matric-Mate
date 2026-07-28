import React from 'react';

/**
 * Renders `fallback` if its children throw.
 *
 * Used where a screen depends on a native module: a dev build made before that
 * module was added would otherwise crash the whole screen, which makes live
 * reload useless until a new binary lands.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Nothing to report — the fallback explains the situation to the user.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
