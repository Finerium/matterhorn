import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './tokens.css';

// ponytail: placeholder root, tokens only. The real surfaces (radar, dissect, archive,
// settings, autopsy) and the router arrive at Gate 3; scaffolding them now would be
// scaffolding twice.
const container = document.getElementById('root');
if (!container) throw new Error('Matterhorn: #root is missing from app/index.html');

createRoot(container).render(
  <StrictMode>
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--paper)',
        color: 'var(--ink)',
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.22em' }}>MATTERHORN</h1>
    </main>
  </StrictMode>,
);
