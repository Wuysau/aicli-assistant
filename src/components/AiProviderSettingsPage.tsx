import { useEffect, useMemo, useState } from 'react'
import { aiProviderExamples } from '../data/aiProviderExamples'
import {
  canManageAiProviders,
  createEmptyProvider,
  getAiProviderStore,
  getAiRuntimeStatus,
  resetProviderForType,
  saveAiProviderStore,
  testAiProviderConnection,
} from '../services/aiSupplementService'
import type {
  AiProviderConfig,
  AiProviderHeader,
  AiProviderStore,
  AiProviderTestResult,
  AiRuntimeStatus,
} from '../types'

const defaultStore: AiProviderStore = {
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
  message: '当前处于基础规则 / 模板模式。',
}

const providerTypeLabelMap: Record<AiProviderConfig['type'], string> = {
  'openai-compatible': 'OpenAI-compatible',
  ollama: 'Ollama / Local',
  'anthropic-compatible': 'Anthropic-compatible（预留）',
}

function createHeader(): AiProviderHeader {
  return {
    id: `header-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key: '',
    value: '',
    enabled: true,
  }
}

export function AiProviderSettingsPage() {
  const [store, setStore] = useState<AiProviderStore>(defaultStore)
  const [runtimeStatus, setRuntimeStatus] = useState<AiRuntimeStatus>(defaultRuntimeStatus)
  const [selectedProviderId, setSelectedProviderId] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [saveMessage, setSaveMessage] = useState('')
  const [testResult, setTestResult] = useState<AiProviderTestResult>()
  const [testing, setTesting] = useState(false)
  const desktopAvailable = canManageAiProviders()

  useEffect(() => {
    let disposed = false

    async function load() {
      setLoading(true)
      const [nextStore, nextRuntimeStatus] = await Promise.all([
        getAiProviderStore(),
        getAiRuntimeStatus(true),
      ])

      if (disposed) {
        return
      }

      setStore(nextStore)
      setRuntimeStatus(nextRuntimeStatus)
      setSelectedProviderId((current) => current ?? nextStore.defaultProviderId ?? nextStore.providers[0]?.id)
      setLoading(false)
    }

    void load()

    return () => {
      disposed = true
    }
  }, [])

  const selectedProvider = useMemo(
    () => store.providers.find((provider) => provider.id === selectedProviderId) ?? store.providers[0],
    [selectedProviderId, store.providers],
  )

  const updateProviders = (updater: (providers: AiProviderConfig[]) => AiProviderConfig[]) => {
    setStore((currentStore) => {
      const nextProviders = updater(currentStore.providers).map((provider) => ({
        ...provider,
        isDefault: currentStore.defaultProviderId
          ? provider.id === currentStore.defaultProviderId
          : provider.isDefault,
      }))

      return {
        ...currentStore,
        providers: nextProviders,
      }
    })
    setSaveMessage('')
    setTestResult(undefined)
  }

  const setDefaultProvider = (providerId?: string) => {
    setStore((currentStore) => ({
      ...currentStore,
      defaultProviderId: providerId,
      providers: currentStore.providers.map((provider) => ({
        ...provider,
        isDefault: provider.id === providerId,
      })),
    }))
    setSaveMessage('')
  }

  const updateSelectedProvider = (partial: Partial<AiProviderConfig>) => {
    if (!selectedProvider) {
      return
    }

    updateProviders((providers) =>
      providers.map((provider) =>
        provider.id === selectedProvider.id
          ? {
              ...provider,
              ...partial,
              updatedAt: new Date().toISOString(),
            }
          : provider,
      ),
    )
  }

  const handleAddProvider = (type: AiProviderConfig['type']) => {
    const provider = createEmptyProvider(type)

    setStore((currentStore) => ({
      ...currentStore,
      providers: [...currentStore.providers, provider],
      defaultProviderId: currentStore.defaultProviderId ?? provider.id,
    }))
    setSelectedProviderId(provider.id)
    setSaveMessage('')
    setTestResult(undefined)
  }

  const handleRemoveProvider = (providerId: string) => {
    setStore((currentStore) => {
      const nextProviders = currentStore.providers.filter((provider) => provider.id !== providerId)
      const nextDefaultProviderId =
        currentStore.defaultProviderId === providerId
          ? nextProviders[0]?.id
          : currentStore.defaultProviderId

      return {
        ...currentStore,
        providers: nextProviders.map((provider) => ({
          ...provider,
          isDefault: provider.id === nextDefaultProviderId,
        })),
        defaultProviderId: nextDefaultProviderId,
      }
    })

    if (selectedProviderId === providerId) {
      setSelectedProviderId(undefined)
    }

    setSaveMessage('')
    setTestResult(undefined)
  }

  const handleSave = async () => {
    if (!desktopAvailable) {
      setSaveMessage('当前是 Web 预览环境，provider 配置保存仅支持桌面版应用。')
      return
    }

    try {
      const savedStore = await saveAiProviderStore(store)
      const status = await getAiRuntimeStatus(true)
      setStore(savedStore)
      setRuntimeStatus(status)
      setSelectedProviderId(savedStore.defaultProviderId ?? savedStore.providers[0]?.id)
      setSaveMessage('配置已保存到本地应用目录。')
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '保存 provider 配置失败。')
    }
  }

  const handleTest = async () => {
    if (!selectedProvider) {
      return
    }

    setTesting(true)
    setTestResult(undefined)

    try {
      const result = await testAiProviderConnection(selectedProvider)
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        providerId: selectedProvider.id,
        providerName: selectedProvider.name,
        providerType: selectedProvider.type,
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : '测试连接失败。',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="settings-page-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">AI 设置</p>
            <h2>把基础规则 / 模板模式和 AI 增强模式分开管理</h2>
          </div>
          <span className="panel-badge">
            {runtimeStatus.mode === 'supplemental' ? 'AI 增强模式' : '基础规则模式'}
          </span>
        </div>

        <div className="status-card-row">
          <article className="empty-state">
            <strong>当前模式</strong>
            <p>{runtimeStatus.message}</p>
          </article>
          <article className="empty-state">
            <strong>默认 Provider</strong>
            <p>
              {runtimeStatus.defaultProviderName
                ? `${runtimeStatus.defaultProviderName} / ${runtimeStatus.model ?? '未设置模型'}`
                : '尚未设置默认 provider'}
            </p>
          </article>
        </div>

        <div className="selection-panel">
          <p className="field-label">运行模式</p>
          <div className="chip-row">
            <button
              type="button"
              className={`choice-chip${store.mode === 'rules-only' ? ' is-active' : ''}`}
              onClick={() => setStore((currentStore) => ({ ...currentStore, mode: 'rules-only' }))}
            >
              基础规则 / 模板模式
            </button>
            <button
              type="button"
              className={`choice-chip${store.mode === 'supplemental' ? ' is-active' : ''}`}
              onClick={() => setStore((currentStore) => ({ ...currentStore, mode: 'supplemental' }))}
            >
              AI 增强模式
            </button>
          </div>
          <p className="helper-text">
            即使未配置任何 provider，模板匹配、环境判断、风险提示和最近记录仍可正常工作。
          </p>
        </div>

        {!desktopAvailable ? (
          <div className="state-card state-card-warning">
            <h2>当前是 Web 预览环境</h2>
            <p>Provider 配置的本地保存和测试连接仅在桌面版应用中可用。</p>
          </div>
        ) : null}
      </section>

      <section className="panel settings-layout">
        <div className="provider-sidebar">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Provider 列表</p>
              <h2>支持多 provider 管理和默认 provider 切换</h2>
            </div>
          </div>

          <div className="chip-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => handleAddProvider('openai-compatible')}
            >
              新增 OpenAI-compatible
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => handleAddProvider('ollama')}
            >
              新增 Ollama
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => handleAddProvider('anthropic-compatible')}
            >
              预留 Anthropic-compatible
            </button>
          </div>

          <div className="provider-list">
            {store.providers.length === 0 ? (
              <div className="empty-state">
                <strong>还没有 provider 配置</strong>
                <p>可以保持纯规则模式，也可以新增一个 provider 用于 AI 增强说明。</p>
              </div>
            ) : (
              store.providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className={`template-browser-card${selectedProvider?.id === provider.id ? ' is-active' : ''}`}
                  onClick={() => setSelectedProviderId(provider.id)}
                >
                  <strong>{provider.name || providerTypeLabelMap[provider.type]}</strong>
                  <span>{providerTypeLabelMap[provider.type]}</span>
                  <p>{provider.model || '未设置模型'}</p>
                  <div className="tag-list">
                    {provider.enabled ? <span className="tag">已启用</span> : <span className="tag">已停用</span>}
                    {store.defaultProviderId === provider.id ? (
                      <span className="tag">默认</span>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="provider-editor">
          {loading ? (
            <div className="state-card state-card-info">
              <h2>正在加载设置</h2>
              <p>正在读取本地 provider 配置和当前运行状态。</p>
            </div>
          ) : selectedProvider ? (
            <>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">当前 Provider</p>
                  <h2>{selectedProvider.name || providerTypeLabelMap[selectedProvider.type]}</h2>
                </div>
                <div className="chip-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setDefaultProvider(selectedProvider.id)}
                  >
                    设为默认
                  </button>
                  <button
                    type="button"
                    className="link-button destructive-link"
                    onClick={() => handleRemoveProvider(selectedProvider.id)}
                  >
                    删除
                  </button>
                </div>
              </div>

              <div className="library-toolbar">
                <label className="toolbar-field">
                  <span>Provider 名称</span>
                  <input
                    type="text"
                    value={selectedProvider.name}
                    onChange={(event) => updateSelectedProvider({ name: event.target.value })}
                  />
                </label>

                <label className="toolbar-field">
                  <span>Provider 类型</span>
                  <select
                    value={selectedProvider.type}
                    onChange={(event) =>
                      updateSelectedProvider(
                        resetProviderForType(
                          selectedProvider,
                          event.target.value as AiProviderConfig['type'],
                        ),
                      )
                    }
                  >
                    <option value="openai-compatible">OpenAI-compatible</option>
                    <option value="ollama">Ollama / Local</option>
                    <option value="anthropic-compatible">Anthropic-compatible（预留）</option>
                  </select>
                </label>

                <label className="toolbar-field">
                  <span>是否启用</span>
                  <select
                    value={selectedProvider.enabled ? 'enabled' : 'disabled'}
                    onChange={(event) =>
                      updateSelectedProvider({ enabled: event.target.value === 'enabled' })
                    }
                  >
                    <option value="enabled">启用</option>
                    <option value="disabled">停用</option>
                  </select>
                </label>
              </div>

              <div className="library-toolbar">
                <label className="toolbar-field">
                  <span>Base URL</span>
                  <input
                    type="text"
                    value={selectedProvider.baseUrl}
                    placeholder={
                      selectedProvider.type === 'ollama'
                        ? 'http://127.0.0.1:11434'
                        : 'https://api.openai.com/v1'
                    }
                    onChange={(event) => updateSelectedProvider({ baseUrl: event.target.value })}
                  />
                </label>

                <label className="toolbar-field">
                  <span>Model</span>
                  <input
                    type="text"
                    value={selectedProvider.model}
                    onChange={(event) => updateSelectedProvider({ model: event.target.value })}
                  />
                </label>

                <label className="toolbar-field">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={selectedProvider.apiKey ?? ''}
                    placeholder={selectedProvider.type === 'ollama' ? '通常可留空' : 'sk-...'}
                    onChange={(event) => updateSelectedProvider({ apiKey: event.target.value })}
                  />
                </label>
              </div>

              <section className="detail-block">
                <h4>自定义 Headers</h4>
                {selectedProvider.customHeaders.length === 0 ? (
                  <p>当前没有自定义 headers。适用于代理、网关或需要额外鉴权的兼容端点。</p>
                ) : (
                  <div className="provider-header-list">
                    {selectedProvider.customHeaders.map((header) => (
                      <div key={header.id} className="provider-header-row">
                        <input
                          type="text"
                          value={header.key}
                          placeholder="Header Key"
                          onChange={(event) =>
                            updateSelectedProvider({
                              customHeaders: selectedProvider.customHeaders.map((item) =>
                                item.id === header.id ? { ...item, key: event.target.value } : item,
                              ),
                            })
                          }
                        />
                        <input
                          type="text"
                          value={header.value}
                          placeholder="Header Value"
                          onChange={(event) =>
                            updateSelectedProvider({
                              customHeaders: selectedProvider.customHeaders.map((item) =>
                                item.id === header.id
                                  ? { ...item, value: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          className={`choice-chip${header.enabled ? ' is-active' : ''}`}
                          onClick={() =>
                            updateSelectedProvider({
                              customHeaders: selectedProvider.customHeaders.map((item) =>
                                item.id === header.id
                                  ? { ...item, enabled: !item.enabled }
                                  : item,
                              ),
                            })
                          }
                        >
                          {header.enabled ? '已启用' : '已停用'}
                        </button>
                        <button
                          type="button"
                          className="link-button destructive-link"
                          onClick={() =>
                            updateSelectedProvider({
                              customHeaders: selectedProvider.customHeaders.filter(
                                (item) => item.id !== header.id,
                              ),
                            })
                          }
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    updateSelectedProvider({
                      customHeaders: [...selectedProvider.customHeaders, createHeader()],
                    })
                  }
                >
                  新增 Header
                </button>
              </section>

              <div className="panel-actions">
                <div className="primary-action-row">
                  <button type="button" className="primary-button" onClick={handleSave}>
                    保存到本地
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleTest}
                    disabled={testing}
                  >
                    {testing ? '正在测试连接...' : '测试连接'}
                  </button>
                </div>
                <p className="helper-text">
                  配置会保存在应用本地目录；密钥不会写进前端源码或仓库文件。
                </p>
                {saveMessage ? <p className="action-feedback">{saveMessage}</p> : null}
                {testResult ? (
                  <p className="action-feedback">
                    {testResult.success ? '连接成功：' : '连接失败：'}
                    {testResult.message}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <strong>先选择或新增一个 provider</strong>
              <p>如果你只想保持纯规则模式，也可以不配置任何 provider，基础功能不会受影响。</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">兼容示例</p>
            <h2>当前推荐优先接入 OpenAI-compatible 和 Ollama</h2>
          </div>
        </div>

        <div className="compact-template-list">
          {aiProviderExamples.map((example) => (
            <article key={example.id} className="template-card">
              <div className="template-meta">
                <span>{providerTypeLabelMap[example.type]}</span>
                <span>{example.baseUrl}</span>
              </div>
              <h3>{example.title}</h3>
              <p>{example.summary}</p>
              <ul className="plain-list">
                <li>{example.authHint}</li>
                <li>{example.modelHint}</li>
              </ul>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
