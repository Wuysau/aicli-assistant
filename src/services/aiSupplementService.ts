import type {
  AiProviderConfig,
  AiProviderStore,
  AiProviderTestResult,
  AiRuntimeStatus,
  AiSupplement,
  AiSupplementRequestPayload,
} from '../types'

const defaultProviderStore: AiProviderStore = {
  schemaVersion: 1,
  mode: 'rules-only',
  providers: [],
  updatedAt: '',
}

const defaultRuntimeStatus: AiRuntimeStatus = {
  enabled: false,
  configured: false,
  available: false,
  mode: 'rules-only',
  providerCount: 0,
  message: '当前处于基础规则 / 模板模式；未启用 AI 增强。',
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

export function canManageAiProviders() {
  return hasTauriInvoke
}

export function createEmptyProvider(
  type: AiProviderConfig['type'] = 'openai-compatible',
): AiProviderConfig {
  const now = new Date().toISOString()

  return {
    id: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    name:
      type === 'ollama'
        ? 'Ollama Local'
        : type === 'anthropic-compatible'
          ? 'Anthropic-compatible'
          : 'OpenAI-compatible',
    enabled: true,
    isDefault: false,
    baseUrl: type === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1',
    apiKey: '',
    model: type === 'ollama' ? 'qwen2.5:7b' : 'gpt-4.1-mini',
    customHeaders: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function resetProviderForType(
  provider: AiProviderConfig,
  nextType: AiProviderConfig['type'],
): AiProviderConfig {
  const now = new Date().toISOString()

  if (nextType === 'ollama') {
    return {
      ...provider,
      type: nextType,
      baseUrl: 'http://127.0.0.1:11434',
      apiKey: '',
      model: 'qwen2.5:7b',
      updatedAt: now,
    }
  }

  if (nextType === 'anthropic-compatible') {
    return {
      ...provider,
      type: nextType,
      baseUrl: 'https://api.anthropic.com',
      apiKey: '',
      model: 'claude-sonnet-4-0',
      updatedAt: now,
    }
  }

  return {
    ...provider,
    type: nextType,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4.1-mini',
    updatedAt: now,
  }
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

export async function getAiProviderStore(): Promise<AiProviderStore> {
  if (!hasTauriInvoke) {
    return defaultProviderStore
  }

  const invoke = await getInvoke()

  if (!invoke) {
    return defaultProviderStore
  }

  try {
    return await invoke<AiProviderStore>('get_ai_provider_store')
  } catch {
    return defaultProviderStore
  }
}

export async function saveAiProviderStore(
  store: AiProviderStore,
): Promise<AiProviderStore> {
  if (!hasTauriInvoke) {
    throw new Error('当前环境不支持本地 provider 配置。')
  }

  const invoke = await getInvoke()

  if (!invoke) {
    throw new Error('无法连接到桌面端 provider 配置接口。')
  }

  const nextStore = await invoke<AiProviderStore>('save_ai_provider_store', {
    store,
  })
  runtimeStatusCache = null
  return nextStore
}

export async function testAiProviderConnection(
  provider: AiProviderConfig,
): Promise<AiProviderTestResult> {
  if (!hasTauriInvoke) {
    return {
      success: false,
      providerId: provider.id,
      providerName: provider.name,
      providerType: provider.type,
      checkedAt: new Date().toISOString(),
      message: 'Web 预览环境不支持测试本地 provider 连接，请使用桌面版应用。',
    }
  }

  const invoke = await getInvoke()

  if (!invoke) {
    throw new Error('无法连接到桌面端 provider 测试接口。')
  }

  return invoke<AiProviderTestResult>('test_ai_provider_connection', {
    provider,
  })
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
