import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { unsupportedTerminalPrefillResult } from './services/terminalBridge'

const hasTauriBridge =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

if (hasTauriBridge) {
  void import('@tauri-apps/api/core')
    .then(({ invoke }) => {
      window.__AICLI_TERMINAL_BRIDGE__ = {
        async setInput(command, options) {
          return invoke('prefill_terminal_input', {
            command,
            shell: options?.shell ?? null,
          })
        },
      }
    })
    .catch(() => {
      window.__AICLI_TERMINAL_BRIDGE__ = {
        async setInput() {
          return unsupportedTerminalPrefillResult
        },
      }
    })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
