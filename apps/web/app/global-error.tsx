'use client';

/**
 * Last-resort boundary: catches a crash in the root layout itself, where
 * nothing else can. It must render its own html/body, and it styles inline
 * because globals.css may be part of what failed.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FAFBF7',
          color: '#0F5064',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, opacity: 0.8, margin: '10px 0 20px' }}>
            The app couldn&rsquo;t start. Reload to try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: 'pointer',
              background: '#096A8B',
              color: '#fff',
              border: 0,
              borderRadius: 14,
              padding: '12px 22px',
              fontSize: 15,
              fontWeight: 700,
              minHeight: 44,
            }}
          >
            Reload
          </button>
          {/* A plain link, not the router: the app itself is what failed, and
              a full page load is the one way home that does not depend on it. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{ display: 'inline-block', marginInlineStart: 10, padding: '12px 16px', minHeight: 44, boxSizing: 'border-box', color: '#096A8B', fontSize: 15, fontWeight: 700 }}
          >
            Go to the homepage
          </a>
        </div>
      </body>
    </html>
  );
}
