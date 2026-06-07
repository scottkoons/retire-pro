import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useStore } from '@/state/store';

export function AppShell() {
  const recovered = useStore((s) => s.recovered);
  const collapsed = useStore((s) => s.ui.sidebarCollapsed);
  return (
    <div
      className="grid h-screen bg-base text-ink transition-[grid-template-columns] duration-200 ease-out"
      style={{ gridTemplateColumns: `${collapsed ? 64 : 240}px 1fr` }}
    >
      <Sidebar />
      <div className="flex min-w-0 flex-col overflow-hidden">
        <TopBar />
        {recovered && (
          <div className="border-b border-error/40 bg-error-tint px-8 py-2 text-[13px] text-error">
            We could not read your saved plan ({recovered}). A backup copy was kept and the demo plan loaded. Import a JSON
            backup from Settings to restore.
          </div>
        )}
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
