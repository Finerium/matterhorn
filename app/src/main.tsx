import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import AppRoutes from './routes';
import { LS, readStore } from './app/state';
import './tokens.css';
import './renderers/renderers.css';
import './shell.css';
import './app/wide.css';

/**
 * The entry. Three jobs: mount the router, apply the remembered theme before first paint, and
 * register the service worker in production only, so neither `pnpm dev` nor the e2e harness
 * ever has a worker between the suite and the server.
 */
const container = document.getElementById('root');
if (!container) throw new Error('Matterhorn: #root is missing from app/index.html');

document.body.dataset.mth = readStore(LS.theme) === 'dark' ? 'dark' : 'light';

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
);

// ponytail: a plain registration rather than the plugin's virtual module. The worker is emitted
// at /sw.js by vite-plugin-pwa's injectManifest, and this is the whole client half of it: no
// update prompt, no reload orchestration. Add those when there is a release cadence to serve.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
