import { useState } from 'react'
import { builtInWorkflows } from '../data/builtInWorkflows'
import { environmentOptions } from '../data/environmentOptions'
import {
  environmentWorkbenchPresets,
  type EnvironmentWorkbenchPreset,
} from '../data/environmentWorkbenchPresets'
import {
  createRecentRecordFromResult,
  resolveWorkflowAssistant,
} from '../services/workflowAssistantService'
import type {
  AssistantRequest,
  AssistantViewState,
  EnvironmentType,
  RecentRecord,
  ScenarioId,
  ShellType,
} from '../types'
import { ResultPanel } from './ResultPanel'

interface EnvironmentLabPageProps {
  onRecordPersist: (record: RecentRecord) => void
}

const shellOptions: ShellType[] = ['powershell', 'cmd', 'wsl', 'bash']

const initialEnvironmentState: AssistantViewState = {
  status: 'idle',
  card: {
    title: '环境判断工作台',
    summary:
      '这个入口专门判断任务应该先在 Windows 本机、WSL / Bash 还是远程 Linux / SSH 中执行，再给出推荐 Shell 和交接步骤。',
    hints: [
      '先描述任务或粘贴命令，再判断执行环境。',
      '如果已经知道问题属于某个高频场景，也可以指定参考模板。',
    ],
    tone: 'info',
  },
}

export function EnvironmentLabPage({
  onRecordPersist,
}: EnvironmentLabPageProps) {
  const [input, setInput] = useState('')
  const [preferredShell, setPreferredShell] = useState<ShellType>('powershell')
  const [environment, setEnvironment] = useState<EnvironmentType>('windows-local')
  const [templateId, setTemplateId] = useState<ScenarioId>('count-log-signals')
  const [state, setState] = useState<AssistantViewState>(initialEnvironmentState)

  const applyPreset = (preset: EnvironmentWorkbenchPreset) => {
    setInput(preset.prompt)
    setTemplateId(preset.scenarioId)
  }

  const handleSubmit = async () => {
    if (input.trim().length === 0) {
      setState({
        status: 'empty',
        card: {
          title: '先输入任务，再判断环境',
          summary: '环境判断需要至少一段任务描述、命令或错误片段。',
          hints: [
            '可以直接输入要执行的命令，例如 `grep "ERROR" application.log | wc -l`。',
            '也可以先点下方预置场景，再继续补充细节。',
          ],
          tone: 'warning',
        },
      })
      return
    }

    const request: AssistantRequest = {
      taskType: 'judge-environment',
      input,
      preferredShell,
      environment,
      templateId,
    }

    setState({
      status: 'loading',
      card: {
        title: '正在判断执行环境',
        summary: '系统正在根据关键词、模板特征和当前环境做本地规则匹配。',
        hints: ['默认先走本地规则；只有必要时才会追加 AI 补充。'],
        tone: 'info',
      },
    })

    try {
      const resolution = await resolveWorkflowAssistant(request)

      if (!resolution.result) {
        const suggestions = resolution.match.suggestedScenarioIds
          .map(
            (scenarioId) =>
              builtInWorkflows.find((template) => template.id === scenarioId)?.title,
          )
          .filter((item): item is string => Boolean(item))

        setState({
          status: 'no-result',
          match: resolution.match,
          aiSupplement: resolution.aiSupplement,
          card: {
            title: '没有稳定命中某个环境模板',
            summary: resolution.aiSupplement?.summary ?? resolution.match.reason,
            hints:
              suggestions.length > 0
                ? [`可以先试这些模板：${suggestions.join('、')}`]
                : ['可以改用更明确的关键词，或直接从模板库选择场景。'],
            tone: 'warning',
          },
        })
        return
      }

      setState({
        status: 'success',
        result: resolution.result,
        match: resolution.match,
      })
      onRecordPersist(
        createRecentRecordFromResult(
          request,
          resolution.result,
          resolution.match,
          'environment-lab',
        ),
      )
    } catch {
      setState({
        status: 'error',
        card: {
          title: '环境判断暂时不可用',
          summary: '本地规则或 AI 补充链路在生成结果时发生异常，但模板库和最近记录仍然可用。',
          hints: ['可以重试一次。', '如果仍失败，先从模板库直接进入对应场景。'],
          tone: 'error',
        },
      })
    }
  }

  return (
    <section className="environment-page-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">环境判断入口</p>
            <h2>先判断去哪执行，再决定命令怎么写</h2>
          </div>
          <span className="panel-badge">环境优先</span>
        </div>

        <label className="field-label" htmlFor="environment-input">
          任务描述或命令
        </label>
        <textarea
          id="environment-input"
          className="prompt-input"
          rows={6}
          value={input}
          placeholder='例如：`grep "ERROR" application.log | wc -l` 应该在哪个环境执行？'
          onChange={(event) => setInput(event.target.value)}
        />

        <div className="selection-grid">
          <div className="selection-panel">
            <p className="field-label">当前 Shell</p>
            <div className="chip-row">
              {shellOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`choice-chip${preferredShell === option ? ' is-active' : ''}`}
                  onClick={() => setPreferredShell(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="selection-panel">
            <p className="field-label">当前所在环境</p>
            <div className="environment-list">
              {environmentOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`environment-card${environment === option.id ? ' is-active' : ''}`}
                  onClick={() => setEnvironment(option.id)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="template-picker">
          <span className="field-label">参考模板</span>
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value as ScenarioId)}
          >
            {builtInWorkflows.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
        </label>

        <div className="panel-actions">
          <button type="button" className="primary-button" onClick={handleSubmit}>
            {state.status === 'loading' ? '正在判断环境...' : '执行环境判断'}
          </button>
          <p className="helper-text">
            当前页面优先依赖本地模板库、关键词匹配和结构化规则；AI 只在必要时补充解释。
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">常见判断场景</p>
            <h2>快速带入高频任务</h2>
          </div>
        </div>

        <div className="preset-grid">
          {environmentWorkbenchPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset-card"
              onClick={() => applyPreset(preset)}
            >
              <strong>{preset.title}</strong>
              <span>{preset.prompt}</span>
            </button>
          ))}
        </div>
      </section>

      <ResultPanel state={state} />
    </section>
  )
}
