import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './styles/theme.css';

import { router } from './app/routes';
import { useStore } from './state/store';

// Apply persisted theme to <html> before first paint of the tree.
const theme = useStore.getState().settings.theme;
document.documentElement.dataset.theme = theme;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
