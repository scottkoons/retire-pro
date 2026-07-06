import { Suspense, lazy, type ReactNode } from 'react';
import { createHashRouter } from 'react-router-dom';
import { AppShell } from './AppShell';

// Route-level code splitting: each page loads on first visit, so the initial
// bundle carries only the shell + dashboard path.
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const PlannerPage = lazy(() => import('@/features/planner/PlannerPage'));
const PhasesPage = lazy(() => import('@/features/phases/PhasesPage'));
const YearByYearPage = lazy(() => import('@/features/yearByYear/YearByYearPage'));
const NetWorthStatementPage = lazy(() => import('@/features/netWorth/NetWorthStatementPage'));
const MonteCarloPage = lazy(() => import('@/features/monteCarlo/MonteCarloPage'));
const ComparePage = lazy(() => import('@/features/compare/ComparePage'));
const WhatIfPage = lazy(() => import('@/features/whatif/WhatIfPage'));
const SummaryPage = lazy(() => import('@/features/summary/SummaryPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

function page(el: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[40vh] place-items-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-primary" role="status" aria-label="Loading page" />
        </div>
      }
    >
      {el}
    </Suspense>
  );
}

// Net Worth, Cash Flow & Taxes, Plan Checkup, and Home & Mortgage were removed to
// simplify the app. Their page code remains under src/features/ for reversibility.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: page(<DashboardPage />) },
      { path: 'planner', element: page(<PlannerPage />) },
      { path: 'phases', element: page(<PhasesPage />) },
      { path: 'year-by-year', element: page(<YearByYearPage />) },
      { path: 'net-worth', element: page(<NetWorthStatementPage />) },
      { path: 'monte-carlo', element: page(<MonteCarloPage />) },
      { path: 'compare', element: page(<ComparePage />) },
      { path: 'what-if', element: page(<WhatIfPage />) },
      { path: 'summary', element: page(<SummaryPage />) },
      { path: 'settings', element: page(<SettingsPage />) },
    ],
  },
]);
