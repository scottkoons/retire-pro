import { useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import {
  IconDashboard,
  IconSheet,
  IconPhases,
  IconTable,
  IconDice,
  IconCompare,
  IconSliders,
  IconCoins,
  IconDoc,
  IconSettings,
  IconChevronLeft,
} from '@/components/icons';
import { useStore } from '@/state/store';

const NAV_GROUPS = [
  {
    heading: 'Plan',
    items: [
      { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true },
      { to: '/planner', label: 'Planner Sheet', Icon: IconSheet },
      { to: '/phases', label: 'Retirement Phases', Icon: IconPhases },
      { to: '/year-by-year', label: 'Year-by-Year', Icon: IconTable },
      { to: '/net-worth', label: 'Net Worth', Icon: IconCoins },
    ],
  },
  {
    heading: 'Analysis',
    items: [
      { to: '/what-if', label: 'What-If Explorer', Icon: IconSliders },
      { to: '/compare', label: 'Compare Scenarios', Icon: IconCompare },
      { to: '/monte-carlo', label: 'Monte Carlo', Icon: IconDice },
      { to: '/summary', label: 'Plan Summary', Icon: IconDoc },
      { to: '/settings', label: 'Settings', Icon: IconSettings },
    ],
  },
];

export function Sidebar({ variant = 'desktop' }: { variant?: 'desktop' | 'drawer' }) {
  const collapsedStore = useStore((s) => s.ui.sidebarCollapsed);
  const toggle = useStore((s) => s.toggleSidebar);
  const saveStatus = useStore((s) => s.saveStatus);
  // The mobile drawer is always fully expanded; only the desktop rail collapses.
  const collapsed = variant === 'drawer' ? false : collapsedStore;

  // Floating label shown beside an icon while collapsed. Portal-rendered with
  // fixed positioning so it escapes the sidebar's overflow clipping.
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const showTip = (label: string) => (e: MouseEvent<HTMLElement>) => {
    if (!collapsed) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  };
  const hideTip = () => setTip(null);

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-border-subtle bg-card">
      {/* Brand */}
      <div className={clsx('flex items-center py-5', collapsed ? 'justify-center px-2' : 'px-5')}>
        {!collapsed ? (
          <span className="whitespace-nowrap font-head text-[22px] font-bold tracking-tight">
            <span className="text-primary">Retire</span>
            <span className="text-ink">Pro</span>
          </span>
        ) : (
          <span className="font-head text-[22px] font-bold tracking-tight text-primary">R</span>
        )}
      </div>

      {/* Collapse / expand control — labelled, sits directly above the Plan group.
          Hidden in the mobile drawer, where collapsing makes no sense. */}
      <div className={clsx(collapsed ? 'px-2' : 'px-3', variant === 'drawer' && 'hidden')}>
        <button
          onClick={() => toggle()}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onMouseEnter={showTip('Expand')}
          onMouseLeave={hideTip}
          className={clsx(
            'flex w-full items-center rounded-md py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted transition-colors hover:bg-hover hover:text-ink',
            collapsed ? 'justify-center px-0' : 'gap-2 px-3',
          )}
        >
          <IconChevronLeft className={clsx('h-4 w-4 shrink-0 transition-transform duration-200', collapsed && 'rotate-180')} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      <nav className={clsx('flex-1 overflow-y-auto py-2', collapsed ? 'px-2' : 'px-3')}>
        {NAV_GROUPS.map((group) => (
          <div key={group.heading} className="mb-2">
            {!collapsed && <div className="label-mono px-3 pb-1 pt-3 text-faint">{group.heading}</div>}
            {group.items.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-label={collapsed ? label : undefined}
                onMouseEnter={showTip(label)}
                onMouseLeave={hideTip}
                className={({ isActive }) =>
                  clsx(
                    'relative mb-1 flex items-center rounded-md py-2 text-[14px] transition-colors',
                    collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                    isActive ? 'bg-primary-tint font-medium text-ink' : 'text-muted hover:bg-hover hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-primary" />}
                    <Icon className={clsx('h-5 w-5 shrink-0', isActive && 'text-primary')} />
                    {!collapsed && <span className="whitespace-nowrap">{label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className={clsx('border-t border-border-subtle py-3', collapsed ? 'flex justify-center px-2' : 'px-5')}>
        <div className={clsx('label-mono flex items-center gap-2', collapsed && 'justify-center')}>
          <span
            className={clsx(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              saveStatus === 'error' ? 'bg-error' : saveStatus === 'saving' ? 'bg-caution' : 'bg-success',
            )}
          />
          {!collapsed && (saveStatus === 'error' ? 'Save failed' : saveStatus === 'saving' ? 'Saving…' : 'Auto-saved')}
        </div>
      </div>

      {collapsed && tip &&
        createPortal(
          <div
            role="tooltip"
            style={{ position: 'fixed', top: tip.top, left: tip.left, transform: 'translateY(-50%)' }}
            className="pointer-events-none z-[100] whitespace-nowrap rounded-md border border-border-strong bg-card-high px-2.5 py-1 text-[12px] font-medium text-ink shadow-lg"
          >
            {tip.label}
          </div>,
          document.body,
        )}
    </aside>
  );
}
