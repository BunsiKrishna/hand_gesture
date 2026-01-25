import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

// --- Infinite Reload Safeguard ---
const MAX_RELOADS = 5;
const RELOAD_RESET_TIME_MS = 10000; // 10 seconds

try {
  const reloadCount = parseInt(sessionStorage.getItem('reload_count') || '0', 10);
  const lastLoadTime = parseInt(sessionStorage.getItem('last_load_time') || '0', 10);
  const now = Date.now();

  if (now - lastLoadTime > RELOAD_RESET_TIME_MS) {
    // Reset if sufficient time has passed
    sessionStorage.setItem('reload_count', '1');
  } else {
    // Increment count
    if (reloadCount >= MAX_RELOADS) {
      // Stop execution to prevent loop
      document.body.innerHTML = `
        <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; color: #fff; font-family: sans-serif;">
          <h1 style="color: #ef4444; font-size: 2rem; margin-bottom: 1rem;">Infinite Reload Detected</h1>
          <p style="color: #94a3b8; margin-bottom: 2rem;">The application has reloaded too many times in a short period.</p>
          <button onclick="sessionStorage.clear(); window.location.reload();" style="padding: 0.75rem 1.5rem; background: #3b82f6; border: none; border-radius: 0.5rem; color: white; cursor: pointer; font-size: 1rem;">
            Reset and Try Again
          </button>
        </div>
      `;
      throw new Error("Safeguard: Infinite reload loop detected.");
    }
    sessionStorage.setItem('reload_count', (reloadCount + 1).toString());
  }
  sessionStorage.setItem('last_load_time', now.toString());
} catch (e) {
  console.error("Reload safeguard error:", e);
}
// ---------------------------------

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
