import { useEffect, useMemo, useState } from 'react'
import { builtInWorkflows } from '../data/builtInWorkflows'
import { copyTextToClipboard } from '../services/clipboardService'
import {
  canPrefillTerminalInput,
  getTerminalPrefillStatus,
  prefillTerminalInput,
  unsupportedTerminalPrefillStatus,
} from '../services/terminalBridge'
import type {
  AssistantResult,
  AssistantViewState,
  CommandVariant,
  EnvironmentJudgementPayload,
  ResultSection,
  RiskImpactScope,
  RiskReversibility,
  ShellType,
} from '../types'

interface ResultPanelProps {
  state: AssistantViewState
}

const impactScopeLabelMap: Record<RiskImpactScope, string> = {
  'current-command': '当前命令',
  'current-repo': '当前仓库',
  'current-machine': '当前机器',
  'remote-host': '远程主机',
}

const reversibilityLabelMap: Record<RiskReversibility, string> = {
  easy: '容易回退',
  partial: '部分可回退',
  hard: '不易回退',
}

const riskLevelLabelMap = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
} as const

const confidenceLabelMap = {
  low: '低',
  medium: '中',
  high: '高',
} as const

const statusLabelMap = {
  idle: '等待开始',
  loading: '分析中',
  empty: '等待输入',
  'no-result': '未命中模板',
  error: '分析异常',
  success: '已生成',
} as const

const environmentLabelMap = {
  'windows-local': 'Windows 本机',
  wsl: 'WSL / Bash',
  'remote-linux': '远程 Linux / SSH',
} as const

const resultKindLabelMap = {
  'command-generation': '命令建议',
  'error-analysis': '报错拆解',
  'environment-judgement': '环境判断',
  'workflow-template': '模板结果',
} as const

const toTemplateTitles = (scenarioIds: string[]) =>
  scenarioIds
    .map((scenarioId) => builtInWorkflows.find((template) => template.id === scenarioId)?.title)
    .filter((item): item is string => Boolean(item))

function renderSection(section: ResultSection) {
  if (section.type === 'paragraph') {
    return (
      <section key={section.id} className="result-block">
        <h3>{section.title}</h3>
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph} className="section-paragraph">
            {paragraph}
          </p>
        ))}
      </section>
    )
  }

  if (section.type === 'list') {
    return (
      <section key={section.id} className="result-block">
        <h3>{section.title}</h3>
        <ul className="plain-list">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    )
  }

  if (section.type === 'tags') {
    return (
      <section key={section.id} className="result-block">
        <h3>{section.title}</h3>
        <div className="tag-list">
          {section.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </section>
    )
  }

  if (section.type === 'commands') {
    return (
      <section key={section.id} className="result-block">
        <h3>{section.title}</h3>
        <div className="variant-list">
          {section.variants.map((variant) => (
            <article key={`${variant.shell}-${variant.command}`} className="variant-card">
              <div className="variant-header">
                <strong>{variant.label}</strong>
                <span>{variant.shell}</span>
              </div>
              <pre>
                <code>{variant.command}</code>
              </pre>
              {variant.notes ? <p>{variant.notes}</p> : null}
            </article>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section key={section.id} className="result-block">
      <h3>{section.title}</h3>
      <div className="step-list">
        {section.steps.map((step, index) => (
          <article key={step.id} className="step-card">
            <div className="step-index">{index + 1}</div>
            <div className="step-content">
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              <span className="step-environment">{environmentLabelMap[step.environment]}</span>
              {step.commands?.length ? (
                <div className="nested-command-list">
                  {step.commands.map((command) => (
                    <article
                      key={`${step.id}-${command.shell}-${command.command}`}
                      className="mini-command-card"
                    >
                      <div className="variant-header">
                        <strong>{command.label}</strong>
                        <span>{command.shell}</span>
                      </div>
                      <pre>
                        <code>{command.command}</code>
                      </pre>
                      {command.notes ? <p>{command.notes}</p> : null}
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function renderEnvironmentSignals(payload: EnvironmentJudgementPayload) {
  const hasSignals =
    payload.supportingSignals.length > 0 || payload.conflictingSignals.length > 0

  if (!hasSignals) {
    return null
  }

  return (
    <section className="result-block">
      <h3>判断依据</h3>
      <div className="signal-grid">
        {payload.supportingSignals.map((signal) => (
          <article key={signal.id} className="signal-card signal-supports">
            <strong>{signal.title}</strong>
            <p>{signal.detail}</p>
          </article>
        ))}
        {payload.conflictingSignals.map((signal) => (
          <article key={signal.id} className="signal-card signal-warning">
            <strong>{signal.title}</strong>
            <p>{signal.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function renderStateCard(state: AssistantViewState) {
  if (state.status === 'success') {
    return null
  }

  const toneClassMap = {
    neutral: 'state-card-neutral',
    info: 'state-card-info',
    warning: 'state-card-warning',
    error: 'state-card-error',
  } as const

  const recommendationIds =
    state.status === 'no-result'
      ? [
          ...state.match.suggestedScenarioIds,
          ...(state.aiSupplement?.relatedTemplateIds ?? []),
        ]
      : []

  const nearMatches = state.status === 'no-result' ? toTemplateTitles(recommendationIds) : []
  const isOffTopic = state.status === 'no-result' && state.match.category === 'off-topic'

  return (
    <section className={`state-card ${toneClassMap[state.card.tone]}`}>
      <h2>{state.card.title}</h2>
      <p>{state.card.summary}</p>

      {state.card.hints.length > 0 ? (
        <ul className="plain-list">
          {state.card.hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : null}

      {state.status === 'no-result' ? (
        <>
          <div className="result-block priority-block">
            <h3>{isOffTopic ? '为什么这次不会继续走自由 AI 问答' : '为什么这次没有稳定命中'}</h3>
            <p>{state.match.reason}</p>
            {state.match.matchedTerms.length > 0 ? (
              <div className="tag-list">
                {state.match.matchedTerms.map((term) => (
                  <span key={term} className="tag">
                    {term}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {state.aiSupplement?.summary && !isOffTopic ? (
            <div className="result-block priority-block">
              <h3>AI 补充判断</h3>
              <p>{state.aiSupplement.summary}</p>
              {state.aiSupplement.explanationBullets.length > 0 ? (
                <ul className="plain-list">
                  {state.aiSupplement.explanationBullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="result-block priority-block">
            <h3>{isOffTopic ? '你可以直接这样使用当前工具' : '你可以先试这些相近场景'}</h3>
            {isOffTopic ? (
              <ul className="plain-list">
                <li>直接输入终端动作、报错片段或环境判断问题。</li>
                <li>如果想看当前 AI 提供商和模型，到设置页查看默认 provider。</li>
                <li>这个面板不会处理“你是谁”这类通用对话。</li>
              </ul>
            ) : nearMatches.length > 0 ? (
              <div className="tag-list">
                {nearMatches.map((item) => (
                  <span key={item} className="tag">
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p>这次输入和已有模板差距较大，建议改写成更明确的终端任务描述。</p>
            )}
          </div>

          <div className="result-block priority-block">
            <h3>下一步建议</h3>
            <ul className="plain-list">
              {state.aiSupplement?.recommendedNextSteps?.length && !isOffTopic ? (
                state.aiSupplement.recommendedNextSteps.map((item) => <li key={item}>{item}</li>)
              ) : isOffTopic ? (
                <>
                  <li>改写成终端动作、报错、日志或环境判断问题。</li>
                  <li>如果已知场景，直接用模板库会更稳。</li>
                  <li>AI 增强只补充终端任务，不会变成通用聊天模式。</li>
                </>
              ) : (
                <>
                  <li>把动作说清楚，例如“查占用”“结束进程”“看容器状态”。</li>
                  <li>补充端口号、错误关键词、日志文件名或执行环境。</li>
                  <li>如果已经知道大致场景，直接从模板库进入会更稳。</li>
                </>
              )}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  )
}

function getCommandPool(result: AssistantResult): {
  variants: CommandVariant[]
  preferredShell: ShellType
} {
  if (result.payload.type === 'command-generation') {
    return {
      variants: result.payload.variants,
      preferredShell: result.preferredShell,
    }
  }

  if (result.payload.type === 'environment-judgement') {
    return {
      variants: result.payload.variants,
      preferredShell: result.payload.recommendedShells[0] ?? result.preferredShell,
    }
  }

  if (result.payload.type === 'error-analysis') {
    return {
      variants: result.payload.quickChecks,
      preferredShell: result.preferredShell,
    }
  }

  return {
    variants: result.payload.starterCommands,
    preferredShell: result.preferredShell,
  }
}

function getPrimaryCommand(result: AssistantResult) {
  const { variants, preferredShell } = getCommandPool(result)
  const primaryVariant =
    variants.find((variant) => variant.shell === preferredShell) ?? variants[0]
  const secondaryVariants = variants.filter(
    (variant) =>
      primaryVariant &&
      !(variant.shell === primaryVariant.shell && variant.command === primaryVariant.command),
  )

  return {
    primaryVariant,
    secondaryVariants,
  }
}

export function ResultPanel({ state }: ResultPanelProps) {
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'success' | 'error'>('idle')
  const [terminalFeedbackMessage, setTerminalFeedbackMessage] = useState('')
  const [terminalStatusMessage, setTerminalStatusMessage] = useState(
    unsupportedTerminalPrefillStatus.message,
  )

  const terminalEnabled = canPrefillTerminalInput()
  const successState = state.status === 'success' ? state : null
  const { primaryVariant } = useMemo(
    () =>
      successState
        ? getPrimaryCommand(successState.result)
        : { primaryVariant: undefined, secondaryVariants: [] },
    [successState],
  )

  useEffect(() => {
    if (!successState || !primaryVariant) {
      return
    }

    let cancelled = false

    void getTerminalPrefillStatus().then((status) => {
      if (cancelled) {
        return
      }

      const terminalLabel = status.terminalLabel
        ? `最近识别到的终端：${status.terminalLabel}。`
        : ''

      setTerminalStatusMessage(`${terminalLabel}${status.message}`.trim())
    })

    return () => {
      cancelled = true
    }
  }, [primaryVariant, successState])

  if (state.status !== 'success') {
    return (
      <section className="panel result-panel">
        <div className="panel-heading compact-panel-heading">
          <div>
            <p className="eyebrow">结果</p>
            <h2>等待这次分析结果</h2>
          </div>
          <span className="panel-badge">{statusLabelMap[state.status]}</span>
        </div>
        {renderStateCard(state)}
      </section>
    )
  }

  const { result, match } = state
  const environmentPayload =
    result.payload.type === 'environment-judgement' ? result.payload : null
  const { secondaryVariants } = getPrimaryCommand(result)
  const detailSections = result.sections.filter((section) => section.type !== 'commands')
  const relatedTemplateTitles = toTemplateTitles(result.relatedTemplateIds.slice(1))

  const handleCopy = async () => {
    if (!primaryVariant) {
      return
    }

    const copied = await copyTextToClipboard(primaryVariant.command)
    setCopyFeedback(copied ? 'success' : 'error')
    window.setTimeout(() => setCopyFeedback('idle'), 1800)
  }

  const handlePrefillTerminal = async () => {
    if (!primaryVariant) {
      return
    }

    try {
      const terminalResult = await prefillTerminalInput(primaryVariant.command, primaryVariant.shell)

      if (terminalResult.success) {
        setTerminalFeedbackMessage(terminalResult.message)
      } else if (terminalResult.fallbackToCopy) {
        const copied = await copyTextToClipboard(primaryVariant.command)
        setTerminalFeedbackMessage(
          copied
            ? `${terminalResult.message} 已自动退回复制方案。`
            : `${terminalResult.message} 请改用复制按钮。`,
        )
      } else {
        setTerminalFeedbackMessage(terminalResult.message)
      }
    } catch {
      const copied = await copyTextToClipboard(primaryVariant.command)
      setTerminalFeedbackMessage(
        copied ? '发送失败，已自动退回复制方案。' : '发送失败，请改用复制按钮。',
      )
    }

    window.setTimeout(() => setTerminalFeedbackMessage(''), 2800)
  }

  return (
    <section className="panel result-panel">
      <div className="panel-heading compact-panel-heading">
        <div>
          <p className="eyebrow">结果</p>
          <h2>{result.title}</h2>
        </div>
        <span className="panel-badge">{resultKindLabelMap[result.kind]}</span>
      </div>

      <div className="badge-row">
        <span className="result-badge tone-info">
          推荐环境：{environmentLabelMap[result.recommendedEnvironment]}
        </span>
        <span className="result-badge tone-info">
          推荐 Shell：{primaryVariant?.shell ?? result.preferredShell}
        </span>
        <span className="result-badge tone-neutral">
          置信度：{confidenceLabelMap[match.confidence]}
        </span>
        <span
          className={`result-badge ${result.riskLevel === 'low' ? 'tone-neutral' : 'tone-warning'}`}
        >
          {riskLevelLabelMap[result.riskLevel]}
        </span>
      </div>

      <div className="action-hero">
        <div className="action-command-card">
          <div className="action-command-meta">
            <strong>推荐命令</strong>
            <span>{primaryVariant?.label ?? '暂无可执行命令'}</span>
          </div>
          <pre className="primary-command-pre">
            <code>{primaryVariant?.command ?? '当前结果没有可直接执行的推荐命令。'}</code>
          </pre>
          <div className="primary-action-row">
            <button
              type="button"
              className="primary-button prominent-button"
              onClick={handleCopy}
              disabled={!primaryVariant}
            >
              {copyFeedback === 'success'
                ? '已复制'
                : copyFeedback === 'error'
                  ? '复制失败'
                  : '一键复制'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handlePrefillTerminal}
              disabled={!primaryVariant}
            >
              发送到终端输入框
            </button>
          </div>
          <p className="action-feedback">
            {terminalFeedbackMessage ||
              (terminalEnabled
                ? '只会把命令插入终端输入框，不会自动回车执行。'
                : '当前环境不支持直接发送到终端时，会自动退回复制方案。')}
          </p>
          <p className="action-feedback">{terminalStatusMessage}</p>
        </div>

        <div className="action-hero-copy">
          <section className="priority-block compact-priority-block">
            <h3>先这样做</h3>
            <p>
              先在 <strong>{environmentLabelMap[result.recommendedEnvironment]}</strong> 中使用{' '}
              <strong>{primaryVariant?.shell ?? result.preferredShell}</strong> 执行推荐命令。
            </p>
          </section>
          <p className="result-summary">{result.summary}</p>
          {result.inputEcho ? (
            <div className="input-echo compact-echo">
              <strong>本次输入</strong>
              <p>{result.inputEcho}</p>
            </div>
          ) : null}
          {result.aiSupplement?.summary ? (
            <div className="priority-block compact-priority-block">
              <h3>AI 补充说明</h3>
              <p>{result.aiSupplement.summary}</p>
            </div>
          ) : null}
        </div>
      </div>

      {result.riskHints.length > 0 ? (
        <details className="fold-panel">
          <summary>查看风险提示</summary>
          <div className="fold-content">
            <div className="priority-block compact-priority-block">
              <h3>执行前先注意这个风险</h3>
              <p>{result.riskHints[0].reason}</p>
            </div>
          </div>
        </details>
      ) : null}

      {result.nextSteps.length > 0 ? (
        <section className="result-block priority-block">
          <h3>接下来建议这样做</h3>
          <ul className="plain-list">
            {result.nextSteps.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {relatedTemplateTitles.length > 0 ? (
        <details className="fold-panel">
          <summary>查看相近模板</summary>
          <div className="fold-content">
            <div className="tag-list">
              {relatedTemplateTitles.map((title) => (
                <span key={title} className="tag">
                  {title}
                </span>
              ))}
            </div>
          </div>
        </details>
      ) : null}

      <details className="fold-panel">
        <summary>查看命中原因和补充说明</summary>
        <div className="fold-content">
          <section className="result-block">
            <h3>为什么推荐这个结果</h3>
            <p>{match.reason}</p>
            {match.matchedTerms.length > 0 ? (
              <div className="tag-list">
                {match.matchedTerms.map((term) => (
                  <span key={term} className="tag">
                    {term}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {environmentPayload ? renderEnvironmentSignals(environmentPayload) : null}
        </div>
      </details>

      {secondaryVariants.length > 0 ? (
        <details className="fold-panel">
          <summary>查看其他 Shell 写法</summary>
          <div className="fold-content">
            <div className="variant-list">
              {secondaryVariants.map((variant) => (
                <article key={`${variant.shell}-${variant.command}`} className="variant-card">
                  <div className="variant-header">
                    <strong>{variant.label}</strong>
                    <span>{variant.shell}</span>
                  </div>
                  <pre>
                    <code>{variant.command}</code>
                  </pre>
                  {variant.notes ? <p>{variant.notes}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </details>
      ) : null}

      {detailSections.length > 0 ? (
        <details className="fold-panel">
          <summary>查看差异说明和补充解释</summary>
          <div className="fold-content">{detailSections.map((section) => renderSection(section))}</div>
        </details>
      ) : null}

      {result.riskHints.length > 0 ? (
        <details className="fold-panel">
          <summary>查看完整风险说明</summary>
          <div className="fold-content">
            <div className="risk-list">
              {result.riskHints.map((risk) => (
                <article key={risk.id} className={`risk-card risk-${risk.level}`}>
                  <div className="risk-header">
                    <strong>{risk.title}</strong>
                    <span>{riskLevelLabelMap[risk.level]}</span>
                  </div>
                  <p>
                    <strong>原因：</strong>
                    {risk.reason}
                  </p>
                  <p>
                    <strong>影响：</strong>
                    {risk.impact}
                  </p>
                  <div className="risk-meta">
                    <span>影响范围：{impactScopeLabelMap[risk.impactScope]}</span>
                    <span>可逆性：{reversibilityLabelMap[risk.reversibility]}</span>
                  </div>
                  {risk.saferAlternative ? (
                    <div className="risk-alternative">
                      <strong>更稳妥的做法</strong>
                      <p>{risk.saferAlternative}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </details>
      ) : null}
    </section>
  )
}
