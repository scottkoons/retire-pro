import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useStore } from '@/state/store';

export function AppShell() {
  const recovered = useStore((s) => s.recovered);
  const collapsed = useStore((s) => s.ui.sidebarCollapsed);
  // Below md the sidebar becomes a slide-over drawer opened from the TopBar.
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div
      className="h-screen bg-base text-ink md:grid md:transition-[grid-template-columns] md:duration-200 md:ease-out md:[grid-template-columns:var(--sidebar-w)_1fr]"
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
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
