import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/inter';
import './styles/theme.css';

import { router } from './app/routes';
import { ErrorBoundary } from './app/ErrorBoundary';
import { useStore } from './state/store';

// A deploy replaces the hashed chunk files, so a tab loaded before the deploy
// 404s when it lazy-loads its next page. Reload once to pick up the new build
// (time-guarded so a genuinely broken server cannot cause a reload loop).
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const KEY = 'retirepro:chunk-reload-at';
  const last = Number(sessionStorage.getItem(KEY) ?? 0);
  if (Date.now() - last < 15_000) return;
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
});

// Apply persisted theme to <html> before first paint of the tree.
const theme = useStore.getState().settings.theme;
document.documentElement.dataset.theme = theme;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>,
);
