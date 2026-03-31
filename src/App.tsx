import { useMemo, useState } from 'react'
import './App.css'
import { AiProviderSettingsPage } from './components/AiProviderSettingsPage'
import { AboutPanel } from './components/AboutPanel'
import { AppNavigation } from './components/AppNavigation'
import { BuiltInTemplatePanel } from './components/BuiltInTemplatePanel'
import { ControlPanel } from './components/ControlPanel'
import { DevVerificationPage } from './components/DevVerificationPage'
import { EnvironmentLabPage } from './components/EnvironmentLabPage'
import { RecentRecordPanel } from './components/RecentRecordPanel'
import { ResultPanel } from './components/ResultPanel'
import { TaskTypeGrid } from './components/TaskTypeGrid'
import { TemplateLibraryPage } from './components/TemplateLibraryPage'
import { appViewOptions } from './data/appViewOptions'
import { builtInWorkflows } from './data/builtInWorkflows'
import { taskTypeOptions } from './data/taskTypeOptions'
import {
  getFrequentTemplateIds,
  getRecentTemplateIds,
  loadLocalAppStore,
  persistRecentRecord,
  recordRecentSearch,
  recordTemplateActivity,
  removeRecentRecord,
  sortTemplatesByMode,
  updateUserPreferences,
} from './services/localAppStoreStorage'
import {
  createRecentRecordFromResult,
  resolveWorkflowAssistant,
} from './services/workflowAssistantService'
import type {
  AiSupplement,
  AppView,
  AssistantRequest,
  AssistantViewState,
  LocalAppStore,
  RecentRecord,
  ScenarioId,
  TaskType,
  TemplateMatchResult,
  VerificationCase,
  WorkflowTemplate,
} from './types'

const initialStore = loadLocalAppStore()

const initialWorkbenchState: AssistantViewState = {
  status: 'idle',
  card: {
    title: '准备开始本次任务',
    summary: '先选任务类型，输入目标或报错，再直接拿到推荐环境、推荐 shell 和推荐命令。',
    hints: [
      '输入尽量短而具体，例如“查 8103 端口占用”或“git push hook 被拒绝”。',
      '推荐命令支持一键复制，也可发送到终端输入框但不会自动执行。',
    ],
    tone: 'info',
  },
}

const toTemplateTitles = (scenarioIds: ScenarioId[]) =>
  scenarioIds
    .map((scenarioId) => builtInWorkflows.find((template) => template.id === scenarioId)?.title)
    .filter((item): item is string => Boolean(item))

const createNoResultState = (
  match: TemplateMatchResult,
  aiSupplement?: AiSupplement,
): AssistantViewState => {
  const suggestionTitles = toTemplateTitles([
    ...match.suggestedScenarioIds,
    ...(aiSupplement?.relatedTemplateIds ?? []),
  ]).slice(0, 3)

  if (match.category === 'off-topic') {
    return {
      status: 'no-result',
      match,
      card: {
        title: '这次输入不属于终端任务面板的处理范围',
        summary:
          '当前版本只处理终端命令、报错排查和环境判断。AI 增强也只用于补充这些任务，不会变成通用聊天模式。',
        hints: [
          '如果你要执行终端任务，直接描述动作、报错片段或环境问题即可。',
          '如果你想查看当前使用的 AI 提供商和模型，请到设置页查看默认 provider。',
        ],
        tone: 'warning',
      },
    }
  }

  return {
    status: 'no-result',
    match,
    aiSupplement,
    card: {
      title: '这次没有稳定命中现有模板',
      summary:
        aiSupplement?.summary ??
        match.reason ??
        '当前输入信息还不够具体，暂时无法稳定归到某个内置场景。',
      hints:
        suggestionTitles.length > 0
          ? [`可先试试这些相近场景：${suggestionTitles.join('、')}`]
          : ['补充动作对象、报错关键词、端口号、日志文件名或执行环境后再试一次。'],
      tone: 'warning',
    },
  }
}

const createErrorState = (): AssistantViewState => ({
  status: 'error',
  card: {
    title: '这次分析没有成功完成',
    summary: '你仍然可以直接使用模板库、最近记录和复制能力，稍后再重试。',
    hints: ['如果问题稳定可复现，优先从模板库进入对应场景会更稳。'],
    tone: 'error',
  },
})

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('workbench')
  const [localStore, setLocalStore] = useState<LocalAppStore>(initialStore)
  const [activeTask, setActiveTask] = useState<TaskType>(initialStore.preferences.taskType)
  const [input, setInput] = useState('')
  const [preferredShell, setPreferredShell] = useState(
    initialStore.preferences.preferredShell,
  )
  const [environment, setEnvironment] = useState(initialStore.preferences.environment)
  const [selectedTemplateId, setSelectedTemplateId] = useState<ScenarioId>(
    initialStore.preferences.selectedTemplateId ?? builtInWorkflows[0].id,
  )
  const [resultState, setResultState] = useState<AssistantViewState>(initialWorkbenchState)

  const activeTaskOption =
    taskTypeOptions.find((option) => option.id === activeTask) ?? taskTypeOptions[0]

  const recentTemplateIds = useMemo(() => getRecentTemplateIds(localStore), [localStore])
  const frequentTemplateIds = useMemo(() => getFrequentTemplateIds(localStore), [localStore])
  const sortedTemplates = useMemo(
    () =>
      sortTemplatesByMode(
        builtInWorkflows,
        localStore.templateActivities,
        localStore.preferences.templateLibrarySortMode,
      ),
    [localStore],
  )

  const quickAccessTemplates = useMemo(() => {
    const orderedIds = [...recentTemplateIds, ...frequentTemplateIds]
    const uniqueTemplates = Array.from(
      new Map(
        orderedIds
          .map((scenarioId) => builtInWorkflows.find((template) => template.id === scenarioId))
          .filter((template): template is WorkflowTemplate => Boolean(template))
          .map((template) => [template.id, template]),
      ).values(),
    )

    if (uniqueTemplates.length >= 4) {
      return uniqueTemplates.slice(0, 4)
    }

    return [...uniqueTemplates, ...builtInWorkflows].slice(0, 4)
  }, [frequentTemplateIds, recentTemplateIds])

  const viewOptions = useMemo(
    () =>
      import.meta.env.DEV
        ? [
            ...appViewOptions,
            {
              id: 'verification-lab' as const,
              label: '验证台',
              description: '只在开发环境显示，用于批量验证模板命中与兜底状态。',
            },
          ]
        : appViewOptions,
    [],
  )

  const updatePreferences = (partial: Partial<LocalAppStore['preferences']>) => {
    setLocalStore((currentStore) => updateUserPreferences(currentStore, partial))
  }

  const persistRecord = (record: RecentRecord) => {
    setLocalStore((currentStore) => {
      let nextStore = persistRecentRecord(currentStore, record)

      if (record.scenarioId) {
        nextStore = recordTemplateActivity(nextStore, record.scenarioId, 'matched')
      }

      return nextStore
    })
  }

  const runWorkbenchRequest = async (request: AssistantRequest) => {
    if (!request.input.trim()) {
      setResultState({
        status: 'empty',
        card: {
          title: '先补充任务，再开始分析',
          summary: '至少输入一段任务描述、命令片段或报错信息，面板才能生成推荐结果。',
          hints: [
            '例如“查 8103 端口占用”“git push hook 被拒绝”“统计日志 ERROR 数量”。',
            '如果你已经知道场景，也可以先用下方常用模板直接进入。',
          ],
          tone: 'warning',
        },
      })
      return
    }

    setResultState({
      status: 'loading',
      card: {
        title: '正在生成本次建议',
        summary: '系统会先走本地模板匹配、环境判断和风险规则，再在必要时补充 AI 说明。',
        hints: ['默认不会把高风险动作的决策权交给 AI。'],
        tone: 'info',
      },
    })

    try {
      const resolution = await resolveWorkflowAssistant(request)

      if (!resolution.result) {
        setResultState(createNoResultState(resolution.match, resolution.aiSupplement))
        setLocalStore((currentStore) => recordRecentSearch(currentStore, request.input, 'workbench'))
        return
      }

      const result = resolution.result

      setResultState({
        status: 'success',
        result,
        match: resolution.match,
      })

      const record = createRecentRecordFromResult(request, result, resolution.match, 'workbench')

      setLocalStore((currentStore) => {
        let nextStore = persistRecentRecord(currentStore, record)
        nextStore = recordRecentSearch(nextStore, request.input, 'workbench')

        const scenarioId = result.relatedTemplateIds[0]
        if (scenarioId) {
          nextStore = recordTemplateActivity(
            nextStore,
            scenarioId,
            request.taskType === 'use-template' ? 'used' : 'matched',
          )
        }

        return nextStore
      })
    } catch {
      setResultState(createErrorState())
    }
  }

  const handleSubmit = () => {
    void runWorkbenchRequest({
      taskType: activeTask,
      input,
      preferredShell,
      environment,
      templateId: selectedTemplateId,
    })
  }

  const handleTaskSelect = (taskType: TaskType) => {
    setActiveTask(taskType)
    updatePreferences({ taskType })
  }

  const handleShellChange = (value: typeof preferredShell) => {
    setPreferredShell(value)
    updatePreferences({ preferredShell: value })
  }

  const handleEnvironmentChange = (value: typeof environment) => {
    setEnvironment(value)
    updatePreferences({ environment: value })
  }

  const handleTemplateChange = (value: ScenarioId) => {
    setSelectedTemplateId(value)
    updatePreferences({ selectedTemplateId: value })
  }

  const handleUseTemplate = (template: WorkflowTemplate) => {
    const nextRequest: AssistantRequest = {
      taskType: 'use-template',
      input: template.samplePrompt,
      preferredShell,
      environment,
      templateId: template.id,
    }

    setActiveView('workbench')
    setSelectedTemplateId(template.id)
    setInput(template.samplePrompt)
    updatePreferences({
      selectedTemplateId: template.id,
    })
    void runWorkbenchRequest(nextRequest)
  }

  const handlePreviewRecord = (record: RecentRecord) => {
    setActiveView('workbench')

    if (record.requestSnapshot) {
      setActiveTask(record.requestSnapshot.taskType)
      setInput(record.requestSnapshot.input)
      setPreferredShell(record.requestSnapshot.preferredShell)
      setEnvironment(record.requestSnapshot.environment)
      if (record.requestSnapshot.templateId) {
        setSelectedTemplateId(record.requestSnapshot.templateId)
      }
    }

    if (record.resultSnapshot && record.matchSnapshot) {
      setResultState({
        status: 'success',
        result: record.resultSnapshot,
        match: record.matchSnapshot,
      })
      return
    }

    setResultState(initialWorkbenchState)
  }

  const handleReuseRecord = (record: RecentRecord) => {
    if (!record.requestSnapshot) {
      handlePreviewRecord(record)
      return
    }

    handlePreviewRecord(record)
    void runWorkbenchRequest(record.requestSnapshot)
  }

  const handleDeleteRecord = (recordId: string) => {
    setLocalStore((currentStore) => removeRecentRecord(currentStore, recordId))
  }

  const handleInjectVerificationCase = (testCase: VerificationCase) => {
    setActiveView('workbench')
    setActiveTask(testCase.taskType)
    setInput(testCase.input)
    setPreferredShell(testCase.preferredShell)
    setEnvironment(testCase.environment)

    if (testCase.templateId) {
      setSelectedTemplateId(testCase.templateId)
    }

    setResultState({
      status: 'idle',
      card: {
        title: '验证用例已带入主面板',
        summary: '你可以直接继续运行，也可以改几个词再验证命中结果。',
        hints: ['这个入口只在开发环境显示。'],
        tone: 'info',
      },
    })
  }

  const renderWorkbench = () => (
    <>
      <section className="quick-command-shell">
        <div className="quick-command-main">
          <TaskTypeGrid
            options={taskTypeOptions}
            activeTask={activeTask}
            onSelect={handleTaskSelect}
          />
          <ControlPanel
            activeTask={activeTaskOption}
            input={input}
            preferredShell={preferredShell}
            environment={environment}
            selectedTemplateId={selectedTemplateId}
            templates={builtInWorkflows}
            loading={resultState.status === 'loading'}
            onInputChange={setInput}
            onShellChange={handleShellChange}
            onEnvironmentChange={handleEnvironmentChange}
            onTemplateChange={handleTemplateChange}
            onSubmit={handleSubmit}
          />
        </div>

        <div
          className={`result-drawer-shell${resultState.status === 'success' ? ' is-open' : ''}`}
        >
          <ResultPanel state={resultState} />
        </div>
      </section>

      <section className="secondary-zone">
        <details className="secondary-fold" open={false}>
          <summary>常用模板</summary>
          <BuiltInTemplatePanel
            templates={quickAccessTemplates}
            activeTemplateId={selectedTemplateId}
            onUseTemplate={handleUseTemplate}
            onBrowseLibrary={() => setActiveView('template-library')}
          />
        </details>

        <details className="secondary-fold" open={false}>
          <summary>最近记录</summary>
          <RecentRecordPanel
            records={localStore.recentRecords}
            onPreviewRecord={handlePreviewRecord}
            onReuseRecord={handleReuseRecord}
            onDeleteRecord={handleDeleteRecord}
          />
        </details>

        <details className="secondary-fold" open={false}>
          <summary>关于与限制</summary>
          <AboutPanel />
        </details>
      </section>
    </>
  )

  return (
    <main className="app-shell compact-app-shell">
      <section className="app-topbar panel">
        <div className="app-topbar-copy">
          <p className="eyebrow">AI CLI Assistant</p>
          <h1>快速命令面板</h1>
          <p className="topbar-summary">
            聚焦一次终端任务闭环：输入问题，拿到推荐环境、推荐 shell 和推荐命令，然后直接复制或发送到终端。
          </p>
        </div>
        <div className="topbar-status">
          <span className="panel-badge">模板与规则主流程</span>
          <span className="panel-badge">AI 仅补充说明</span>
        </div>
      </section>

      <section className="workspace-grid compact-workspace-grid">
        <div className="main-column">
          <AppNavigation
            options={viewOptions}
            activeView={activeView}
            onSelect={setActiveView}
          />

          {activeView === 'workbench' ? renderWorkbench() : null}

          {activeView === 'template-library' ? (
            <TemplateLibraryPage
              templates={sortedTemplates}
              activeTemplateId={selectedTemplateId}
              filterState={localStore.preferences.templateLibraryFilter}
              sortMode={localStore.preferences.templateLibrarySortMode}
              recentSearches={localStore.recentSearchKeywords.filter(
                (item) => item.source === 'template-library',
              )}
              recentTemplateIds={recentTemplateIds}
              frequentTemplateIds={frequentTemplateIds}
              templateActivities={localStore.templateActivities}
              onSelectTemplate={handleTemplateChange}
              onFilterChange={(nextFilter) =>
                updatePreferences({ templateLibraryFilter: nextFilter })
              }
              onSortModeChange={(nextSortMode) =>
                updatePreferences({ templateLibrarySortMode: nextSortMode })
              }
              onUseTemplate={handleUseTemplate}
              onSearchCommitted={(query) =>
                setLocalStore((currentStore) =>
                  recordRecentSearch(currentStore, query, 'template-library'),
                )
              }
            />
          ) : null}

          {activeView === 'environment-lab' ? (
            <EnvironmentLabPage onRecordPersist={persistRecord} />
          ) : null}

          {activeView === 'settings' ? <AiProviderSettingsPage /> : null}

          {import.meta.env.DEV && activeView === 'verification-lab' ? (
            <DevVerificationPage onInjectCase={handleInjectVerificationCase} />
          ) : null}
        </div>
      </section>
    </main>
  )
}
