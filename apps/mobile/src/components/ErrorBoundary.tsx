import React from 'react';

/**
 * Renders `fallback` if its children throw.
 *
 * Used where a screen depends on a native module: a dev build made before that
 * module was added would otherwise crash the whole screen, which makes live
 * reload useless until a new binary lands.
 *
 * `fallback` can be a function of `reset`, which mounts the children again:
 * for a failure that is not a missing module, a Retry that actually retries.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode | ((reset: () => void) => React.ReactNode) },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // For whoever reads the logs; the fallback is what the student sees.
    console.warn('ErrorBoundary caught', error);
  }

  reset = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === 'function' ? fallback(this.reset) : fallback;
  }
}
