import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initWebMCP } from './services/webmcp';
import './index.css';

// Initialize WebMCP as early as possible — before React renders and before the
// Phaser game boots — so agent-discoverable tools exist at first JS execution.
// Guarded so an experimental/flagged browser API can never block app startup.
try {
  initWebMCP();
} catch (err) {
  console.error('[WebMCP] Early initialization failed; App.tsx will retry.', err);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
