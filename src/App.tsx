import { useMemo, useState } from 'react'
import './App.css'
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
    title: '先选任务，再完成这一轮终端工作流。',
    summary:
      '当前版本优先使用本地模板库、关键词匹配和风险规则来给出推荐环境、推荐 Shell、推荐命令和下一步建议。',
    hints: [
      '输入可以是自然语言、报错片段或短关键词，不必组织成聊天式长问题。',
      '如果模板没有稳定命中，系统会先给出相近场景和补充建议，再决定是否请求 AI 解释补充。',
      '发送到终端只会插入命令，不会自动回车执行。',
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

  return {
    status: 'no-result',
    match,
    aiSupplement,
    card: {
      title: '这次输入没有稳定命中现有模板。',
      summary:
        aiSupplement?.summary ??
        match.reason ??
        '当前输入信息仍然偏少，暂时无法把任务稳定收敛到某一个内置场景。',
      hints:
        suggestionTitles.length > 0
          ? [`可以先试试这些相近场景：${suggestionTitles.join('、')}`]
          : [
              '建议补充动作对象、报错关键词、端口号、日志文件名或执行环境，再重试一次。',
            ],
      tone: 'warning',
    },
  }
}

const createErrorState = (): AssistantViewState => ({
  status: 'error',
  card: {
    title: '本地分析流程暂时不可用。',
    summary:
      '这次没有成功生成结果，但模板库、最近记录和复制能力仍然可用。可以直接从模板库进入对应场景，或稍后重试。',
    hints: [
      '先检查输入里是否包含异常调试片段。',
      '如果问题稳定可复现，建议优先从模板页进入对应场景。',
    ],
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
              description: '仅开发环境可见，用于批量验证模板命中、风险等级和兜底状态。',
            },
          ]
        : appViewOptions,
    [],
  )

  const updatePreferences = (
    partial: Partial<LocalAppStore['preferences']>,
  ) => {
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
          title: '先补充任务，再生成结果。',
          summary:
            '工作台至少需要一段任务描述、命令片段或报错信息，才能稳定命中模板并生成推荐结果。',
          hints: [
            '可以直接输入“查 8103 端口占用”“git push 被 hook 拒绝”“统计日志 ERROR 数量”这类短句。',
            '如果已经知道要走哪个场景，也可以直接点击下方模板快捷入口。',
          ],
          tone: 'warning',
        },
      })
      return
    }

    setResultState({
      status: 'loading',
      card: {
        title: '正在整理当前任务。',
        summary:
          '系统会先做本地模板匹配、环境判断和风险规则分析，再在必要时请求受约束的 AI 补充说明。',
        hints: ['默认优先本地规则，不会把高风险动作的决定权交给 AI。'],
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

      const record = createRecentRecordFromResult(
        request,
        result,
        resolution.match,
        'workbench',
      )

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
    setActiveTask('use-template')
    setSelectedTemplateId(template.id)
    setInput(template.samplePrompt)
    updatePreferences({
      taskType: 'use-template',
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
        title: '验证用例已带入工作台。',
        summary: '你可以直接继续运行，或在当前输入基础上修改细节再验证匹配结果。',
        hints: ['这个入口只在开发环境显示，不会出现在发布版里。'],
        tone: 'info',
      },
    })
  }

  const renderWorkbench = () => (
    <>
      <section className="workbench-focus-grid">
        <div className="workbench-task-column">
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

        <ResultPanel state={resultState} />
      </section>

      <section className="workspace-grid">
        <div className="main-column">
          <BuiltInTemplatePanel
            templates={quickAccessTemplates}
            activeTemplateId={selectedTemplateId}
            onUseTemplate={handleUseTemplate}
            onBrowseLibrary={() => setActiveView('template-library')}
          />

          <details className="secondary-fold">
            <summary>查看最近记录</summary>
            <RecentRecordPanel
              records={localStore.recentRecords}
              onPreviewRecord={handlePreviewRecord}
              onReuseRecord={handleReuseRecord}
              onDeleteRecord={handleDeleteRecord}
            />
          </details>
        </div>

        <div className="secondary-stack">
          <AboutPanel />
        </div>
      </section>
    </>
  )

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <h1>把终端高频问题收敛成可判断、可复用、可持续使用的本地工作流。</h1>
          <p className="hero-text">
            AI CLI Assistant 当前定位为 Windows Terminal Workflow Assistant。它优先依赖本地模板库、
            关键词匹配、环境判断和风险规则来完成一次任务闭环；只有在模板未稳定命中或解释仍然不足时，
            才会请求受约束的 AI 补充说明。
          </p>
          <div className="status-strip">
            <span>首批 10 个内置场景</span>
            <span>本地规则优先</span>
            <span>仅插入终端，不自动执行</span>
            <span>支持完全离线模式</span>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
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

          {import.meta.env.DEV && activeView === 'verification-lab' ? (
            <DevVerificationPage onInjectCase={handleInjectVerificationCase} />
          ) : null}
        </div>
      </section>
    </main>
  )
}
