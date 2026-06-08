import { createHashRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import DashboardPage from '@/features/dashboard/DashboardPage';
import PlannerPage from '@/features/planner/PlannerPage';
import PhasesPage from '@/features/phases/PhasesPage';
import YearByYearPage from '@/features/yearByYear/YearByYearPage';
import MonteCarloPage from '@/features/monteCarlo/MonteCarloPage';
import SummaryPage from '@/features/summary/SummaryPage';
import SettingsPage from '@/features/settings/SettingsPage';
import NetWorthPage from '@/features/netWorth/NetWorthPage';
import CashFlowPage from '@/features/cashFlow/CashFlowPage';
import CheckupPage from '@/features/checkup/CheckupPage';
import HomeMortgagePage from '@/features/home/HomeMortgagePage';

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'net-worth', element: <NetWorthPage /> },
      { path: 'cash-flow', element: <CashFlowPage /> },
      { path: 'checkup', element: <CheckupPage /> },
      { path: 'planner', element: <PlannerPage /> },
      { path: 'home', element: <HomeMortgagePage /> },
      { path: 'phases', element: <PhasesPage /> },
      { path: 'year-by-year', element: <YearByYearPage /> },
      { path: 'monte-carlo', element: <MonteCarloPage /> },
      { path: 'summary', element: <SummaryPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
