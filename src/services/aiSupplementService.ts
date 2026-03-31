import type {
  AiRuntimeStatus,
  AiSupplement,
  AiSupplementRequestPayload,
} from '../types'

const defaultRuntimeStatus: AiRuntimeStatus = {
  enabled: false,
  configured: false,
  available: false,
  mode: 'disabled',
  message: '当前运行环境未启用 AI 补充能力，默认仅使用本地规则和模板库。',
}

const hasTauriInvoke =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

let runtimeStatusCache: Promise<AiRuntimeStatus> | null = null

async function getInvoke() {
  if (!hasTauriInvoke) {
    return null
  }

  const core = await import('@tauri-apps/api/core')
  return core.invoke
}

export async function getAiRuntimeStatus(
  forceRefresh = false,
): Promise<AiRuntimeStatus> {
  if (!hasTauriInvoke) {
    return defaultRuntimeStatus
  }

  if (!runtimeStatusCache || forceRefresh) {
    runtimeStatusCache = getInvoke()
      .then(async (invoke) => {
        if (!invoke) {
          return defaultRuntimeStatus
        }

        return invoke<AiRuntimeStatus>('get_ai_runtime_status')
      })
      .catch(() => defaultRuntimeStatus)
  }

  return runtimeStatusCache
}

export async function generateAiSupplement(
  payload: AiSupplementRequestPayload,
): Promise<AiSupplement | undefined> {
  const runtimeStatus = await getAiRuntimeStatus()

  if (!runtimeStatus.available) {
    return undefined
  }

  const invoke = await getInvoke()

  if (!invoke) {
    return undefined
  }

  try {
    return invoke<AiSupplement>('generate_ai_supplement', { payload })
  } catch {
    return undefined
  }
}
