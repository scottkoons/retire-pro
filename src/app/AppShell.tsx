import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useStore } from '@/state/store';

export function AppShell() {
  const recovered = useStore((s) => s.recovered);
  const collapsed = useStore((s) => s.ui.sidebarCollapsed);
  const planFile = useStore((s) => s.planFile);
  const initPlanFile = useStore((s) => s.initPlanFile);
  const reconnectPlanFile = useStore((s) => s.reconnectPlanFile);
  // Below md the sidebar becomes a slide-over drawer opened from the TopBar.
  const [mobileNav, setMobileNav] = useState(false);

  // Re-attach the plan file once per load. Deliberately after mount rather than
  // at store creation: reading the handle and the file is async, while the
  // store boots synchronously from localStorage so the first paint never waits.
  useEffect(() => {
    void initPlanFile();
  }, [initPlanFile]);

  // Ask the browser to treat this origin's storage as durable so it is not
  // evicted under disk pressure. Chrome grants it silently for installed apps.
  // It is a request rather than a guarantee, which is exactly why the plan file
  // above is the real durability story and this is only belt and braces.
  useEffect(() => {
    void navigator.storage?.persist?.();
  }, []);

  return (
    <div
      className="rp-app-bg h-screen text-ink md:grid md:transition-[grid-template-columns] md:duration-200 md:ease-out md:[grid-template-columns:var(--sidebar-w)_1fr]"
      style={{ '--sidebar-w': `${collapsed ? 64 : 240}px` } as React.CSSProperties}
    >
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {mobileNav && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} aria-hidden />
          {/* Any tap inside (nav link, brand) closes the drawer after acting. */}
          <div className="absolute inset-y-0 left-0 w-64 shadow-overlay" onClick={() => setMobileNav(false)}>
            <Sidebar variant="drawer" />
          </div>
        </div>
      )}

      <div className="flex h-screen min-w-0 flex-col overflow-hidden md:h-auto">
        <TopBar onMenu={() => setMobileNav(true)} />
        {recovered && (
          <div className="border-b border-error/40 bg-error-tint px-4 py-2 text-[13px] text-error md:px-8">
            We could not read your saved plan ({recovered}). A backup copy was kept and the demo plan loaded. Import a JSON
            backup from Settings to restore.
          </div>
        )}
        {/* Chrome drops a saved file handle back to "ask" on every restart, so
            this is the normal once-per-session reconnect, not an error. */}
        {planFile.status === 'needs-permission' && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-caution/40 bg-caution-tint px-4 py-2 text-[13px] text-caution md:px-8">
            <span>
              Your plan is not being saved to <strong className="font-semibold">{planFile.name ?? 'your plan file'}</strong> yet.
            </span>
            <button
              type="button"
              onClick={() => void reconnectPlanFile()}
              className="rounded border border-caution/50 px-2 py-0.5 font-semibold transition-colors hover:bg-caution/10"
            >
              Reconnect
            </button>
          </div>
        )}
        {planFile.status === 'error' && planFile.error && (
          <div className="border-b border-error/40 bg-error-tint px-4 py-2 text-[13px] text-error md:px-8">
            Plan file: {planFile.error} Your plan is still saved in this browser.
          </div>
        )}
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
