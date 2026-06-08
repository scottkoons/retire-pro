import { createHashRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import DashboardPage from '@/features/dashboard/DashboardPage';
import PlannerPage from '@/features/planner/PlannerPage';
import PhasesPage from '@/features/phases/PhasesPage';
import YearByYearPage from '@/features/yearByYear/YearByYearPage';
import MonteCarloPage from '@/features/monteCarlo/MonteCarloPage';
import SummaryPage from '@/features/summary/SummaryPage';
import SettingsPage from '@/features/settings/SettingsPage';

// Net Worth, Cash Flow & Taxes, Plan Checkup, and Home & Mortgage were removed to
// simplify the app. Their page code remains under src/features/ for reversibility.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'planner', element: <PlannerPage /> },
      { path: 'phases', element: <PhasesPage /> },
      { path: 'year-by-year', element: <YearByYearPage /> },
      { path: 'monte-carlo', element: <MonteCarloPage /> },
      { path: 'summary', element: <SummaryPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
