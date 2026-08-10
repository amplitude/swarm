import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { initializeStore } from './store/app-store';
import './index.css';

// Register all tool and skill definitions on app load
import '@/tools/definitions';
import '@/skills/definitions';

initializeStore().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
