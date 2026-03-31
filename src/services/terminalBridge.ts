import type { ShellType } from '../types'

export interface TerminalPrefillResult {
  success: boolean
  inserted: boolean
  terminalLabel?: string
  message: string
  clipboardRestored: boolean
  fallbackToCopy: boolean
}

export interface TerminalPrefillStatus {
  supported: boolean
  available: boolean
  terminalLabel?: string
  message: string
}

declare global {
  interface Window {
    __AICLI_TERMINAL_BRIDGE__?: {
      setInput: (
        command: string,
        options?: { shell?: ShellType },
      ) => TerminalPrefillResult | Promise<TerminalPrefillResult>
    }
    __TAURI_INTERNALS__?: unknown
    __TAURI__?: unknown
  }
}

const hasTauriInvoke =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

export const TERMINAL_PREFILL_EVENT = 'aicli:prefill-terminal-input'

export const unsupportedTerminalPrefillResult: TerminalPrefillResult = {
  success: false,
  inserted: false,
  message: '当前环境没有可用的终端输入框桥接能力，建议直接复制命令。',
  clipboardRestored: false,
  fallbackToCopy: true,
}

export const unsupportedTerminalPrefillStatus: TerminalPrefillStatus = {
  supported: false,
  available: false,
  message: '当前环境不支持终端输入框粘贴能力，会自动退回复制方案。',
}

export function canPrefillTerminalInput(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.__AICLI_TERMINAL_BRIDGE__?.setInput === 'function'
  )
}

export async function getTerminalPrefillStatus(): Promise<TerminalPrefillStatus> {
  if (!hasTauriInvoke) {
    return unsupportedTerminalPrefillStatus
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<TerminalPrefillStatus>('get_terminal_prefill_status')
  } catch {
    return unsupportedTerminalPrefillStatus
  }
}

export async function prefillTerminalInput(
  command: string,
  shell: ShellType,
): Promise<TerminalPrefillResult> {
  if (!canPrefillTerminalInput()) {
    return unsupportedTerminalPrefillResult
  }

  const result =
    (await window.__AICLI_TERMINAL_BRIDGE__?.setInput(command, { shell })) ??
    unsupportedTerminalPrefillResult

  window.dispatchEvent(
    new CustomEvent(TERMINAL_PREFILL_EVENT, {
      detail: { command, shell, result },
    }),
  )

  return result
}
