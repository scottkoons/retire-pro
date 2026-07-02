import { Component, type ReactNode } from 'react';

/**
 * Last-resort error screen: any render/runtime error in the tree shows a
 * friendly reload prompt instead of a blank page. The most common real cause
 * is a tab that predates a deploy (its lazy page chunks were replaced); a
 * reload picks up the current build. Plan data lives in localStorage and is
 * unaffected by render errors.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-base p-8 text-ink">
          <div className="max-w-md text-center">
            <h1 className="font-head text-[24px] font-semibold">Something went wrong</h1>
            <p className="mt-2 text-[14px] text-muted">
              Reloading usually fixes this; it picks up the latest version of the app.
              Your plan data is stored in this browser and is not affected.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded bg-primary px-5 py-2 text-[14px] font-semibold text-primary-on hover:bg-primary-hover"
            >
              Reload
            </button>
            <pre className="mt-6 overflow-x-auto rounded-lg border border-border-subtle bg-card p-3 text-left text-[11px] text-faint">
              {String(this.state.error)}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
