import { useMemo, useState } from 'react'
import { builtInWorkflows } from '../data/builtInWorkflows'
import { verificationCases } from '../data/verificationCases'
import {
  getVerificationPack,
  runVerificationCase,
} from '../services/verificationRunner'
import { resolveWorkflowAssistant } from '../services/workflowAssistantService'
import type {
  AssistantViewState,
  VerificationCase,
  VerificationCaseKind,
  VerificationOutcome,
} from '../types'
import { ResultPanel } from './ResultPanel'

interface DevVerificationPageProps {
  onInjectCase: (testCase: VerificationCase) => void
}

const kindLabels: Record<VerificationCaseKind, string> = {
  standard: '标准输入',
  fuzzy: '模糊输入',
  'no-result': '无结果输入',
  error: '异常输入',
}

const environmentLabels = {
  'windows-local': 'Windows 本机',
  wsl: 'WSL / Bash',
  'remote-linux': '远端 Linux / SSH',
} as const

const riskLabels = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
} as const

const initialState: AssistantViewState = {
  status: 'idle',
  card: {
    title: '开发验证模式',
    summary:
      '选择一条测试用例后，即可快速验证模板命中、推荐环境、风险等级和结果结构。',
    hints: [
      '仅开发环境显示。',
      '支持标准输入、模糊输入、无结果输入和异常输入。',
      '可直接把测试输入注入工作台继续人工试用。',
    ],
    tone: 'info',
  },
}

const templateMap = new Map(builtInWorkflows.map((template) => [template.id, template]))

export function DevVerificationPage({ onInjectCase }: DevVerificationPageProps) {
  const [selectedKind, setSelectedKind] = useState<VerificationCaseKind | 'all'>('all')
  const [selectedCaseId, setSelectedCaseId] = useState(verificationCases[0]?.id ?? '')
  const [resultState, setResultState] = useState<AssistantViewState>(initialState)
  const [outcome, setOutcome] = useState<VerificationOutcome>()

  const filteredCases = useMemo(
    () =>
      selectedKind === 'all'
        ? verificationCases
        : verificationCases.filter((item) => item.kind === selectedKind),
    [selectedKind],
  )

  const selectedCase =
    filteredCases.find((item) => item.id === selectedCaseId) ??
    verificationCases.find((item) => item.id === selectedCaseId) ??
    filteredCases[0]

  const activePack = getVerificationPack(
    outcome?.actualScenarioId ?? selectedCase?.expectedScenarioId,
  )

  const handleRun = async (testCase: VerificationCase) => {
    setSelectedCaseId(testCase.id)
    setResultState({
      status: 'loading',
      card: {
        title: `正在验证：${testCase.title}`,
        summary: '正在使用本地模板目录和结构化规则执行自动验证。',
        hints: ['当前过程不会访问真实 AI 接口。'],
        tone: 'info',
      },
    })

    const nextOutcome = await runVerificationCase(testCase)
    setOutcome(nextOutcome)

    if (nextOutcome.status === 'success') {
      const request = {
        taskType: testCase.taskType,
        input: testCase.input,
        preferredShell: testCase.preferredShell,
        environment: testCase.environment,
        templateId: testCase.templateId,
      } as const

      const result = await resolveWorkflowAssistant(request)

      if (result.result) {
        setResultState({
          status: 'success',
          result: result.result,
          match: result.match,
        })
        return
      }
    }

    if (nextOutcome.status === 'no-result') {
      setResultState({
        status: 'no-result',
        match: {
          matched: false,
          suggestedScenarioIds: [],
          matchedTerms: [],
          score: 0,
          confidence: 'low',
          reason: '该用例用于验证 no-result 兜底路径。',
        },
        card: {
          title: '本次输入未命中模板',
          summary: '当前用例被设计为 no-result 输入，用于验证兜底提示是否稳定。',
          hints: ['建议检查页面是否出现误命中。'],
          tone: 'warning',
        },
      })
      return
    }

    if (nextOutcome.status === 'error') {
      setResultState({
        status: 'error',
        card: {
          title: '开发异常输入已触发',
          summary: '当前用例用于验证本地异常态与兜底提示。',
          hints: [nextOutcome.errorMessage ?? 'Unknown error'],
          tone: 'error',
        },
      })
    }
  }

  return (
    <section className="verification-page-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">开发验证模式</p>
            <h2>快速验证首批 10 个场景的匹配与结果结构</h2>
          </div>
          <span className="panel-badge">DEV ONLY</span>
        </div>

        <div className="verification-kind-row">
          <button
            type="button"
            className={`choice-chip${selectedKind === 'all' ? ' is-active' : ''}`}
            onClick={() => setSelectedKind('all')}
          >
            全部
          </button>
          {(
            ['standard', 'fuzzy', 'no-result', 'error'] as VerificationCaseKind[]
          ).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`choice-chip${selectedKind === kind ? ' is-active' : ''}`}
              onClick={() => setSelectedKind(kind)}
            >
              {kindLabels[kind]}
            </button>
          ))}
        </div>

        <div className="verification-case-list">
          {filteredCases.map((testCase) => (
            <article
              key={testCase.id}
              className={`verification-case-card${selectedCaseId === testCase.id ? ' is-active' : ''}`}
            >
              <div className="verification-case-meta">
                <span>{kindLabels[testCase.kind]}</span>
                <span>
                  {testCase.expectedScenarioId
                    ? templateMap.get(testCase.expectedScenarioId)?.title
                    : testCase.expectedError
                      ? '异常态'
                      : '无匹配'}
                </span>
              </div>
              <strong>{testCase.title}</strong>
              <p>{testCase.input}</p>
              <div className="verification-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    void handleRun(testCase)
                  }}
                >
                  运行验证
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onInjectCase(testCase)}
                >
                  注入工作台
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel verification-summary-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">人工验证清单</p>
            <h2>查看命中结果、模板来源与风险信息</h2>
          </div>
          <span
            className={`panel-badge${outcome && !outcome.expectedPass ? ' verification-badge-warning' : ''}`}
          >
            {outcome ? (outcome.expectedPass ? 'PASS' : 'CHECK') : 'READY'}
          </span>
        </div>

        {selectedCase ? (
          <div className="verification-summary-grid">
            <article className="verification-summary-card">
              <strong>当前用例</strong>
              <p>{selectedCase.title}</p>
              <span>{selectedCase.input}</span>
            </article>
            <article className="verification-summary-card">
              <strong>期望命中</strong>
              <p>
                {selectedCase.expectedScenarioId
                  ? templateMap.get(selectedCase.expectedScenarioId)?.title
                  : selectedCase.expectedError
                    ? '异常态'
                    : '无结果'}
              </p>
              <span>{kindLabels[selectedCase.kind]}</span>
            </article>
            <article className="verification-summary-card">
              <strong>实际命中</strong>
              <p>
                {outcome?.actualScenarioTitle ??
                  (outcome?.status === 'no-result'
                    ? '无结果'
                    : outcome?.status === 'error'
                      ? '异常态'
                      : '待运行')}
              </p>
              <span>{outcome?.actualScenarioSource ?? '待运行'}</span>
            </article>
            <article className="verification-summary-card">
              <strong>推荐环境 / 风险</strong>
              <p>
                {outcome?.recommendedEnvironment
                  ? environmentLabels[outcome.recommendedEnvironment]
                  : '待运行'}
              </p>
              <span>
                {outcome?.riskLevel ? riskLabels[outcome.riskLevel] : '待运行'}
              </span>
            </article>
          </div>
        ) : null}

        {outcome?.errorMessage ? (
          <div className="verification-note">
            <strong>异常信息</strong>
            <p>{outcome.errorMessage}</p>
          </div>
        ) : null}

        {selectedCase?.notes ? (
          <div className="verification-note">
            <strong>验证说明</strong>
            <p>{selectedCase.notes}</p>
          </div>
        ) : null}

        {activePack ? (
          <div className="verification-note">
            <strong>该场景常见表达覆盖</strong>
            <div className="tag-list">
              {activePack.expressions.map((expression) => (
                <span key={expression} className="tag">
                  {expression}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <ResultPanel state={resultState} />
    </section>
  )
}
