import { useState } from 'react'
import { BuiltInTemplatePanel } from './components/BuiltInTemplatePanel'
import { ControlPanel } from './components/ControlPanel'
import { RecentRecordPanel } from './components/RecentRecordPanel'
import { ResultPanel } from './components/ResultPanel'
import { TaskTypeGrid } from './components/TaskTypeGrid'
import { builtInWorkflows } from './data/builtInWorkflows'
import { taskTypeOptions } from './data/taskTypeOptions'
import { recentRecords } from './mock/recentRecords'
import { resolveWorkflowAssistant } from './services/workflowAssistantService'
import './App.css'
import type {
  AssistantResult,
  EnvironmentType,
  ShellType,
  TaskType,
  WorkflowTemplate,
} from './types'

const initialTask = taskTypeOptions[0]

const initialResult: AssistantResult = {
  kind: 'command-generation',
  taskType: 'generate-command',
  title: 'Windows Terminal Workflow Assistant',
  summary:
    '这个首页不是聊天窗口，而是一个终端工作流面板。先选任务类型，再决定 shell 和执行环境，最后用 mock 结果验证交互闭环。',
  recommendedEnvironment: 'windows-local',
  variants: [
    {
      shell: 'powershell',
      label: 'PowerShell',
      command:
        'Get-NetTCPConnection -LocalPort 8103 | Select-Object LocalPort, State, OwningProcess',
      available: true,
      notes: '这里只是默认示例，用来占位结果区域。',
    },
  ],
  differenceNotes: [
    '后续真实 AI 接入时，只需要替换服务层输出，不需要推翻页面结构。',
  ],
  risks: [],
  nextSteps: [
    '从顶部四个任务入口里选一个。',
    '输入任务、命令或报错。',
    '选择目标 shell 与环境，再运行工作流。',
  ],
}

function App() {
  const [taskType, setTaskType] = useState<TaskType>(initialTask.id)
  const [input, setInput] = useState('')
  const [preferredShell, setPreferredShell] = useState<ShellType>('powershell')
  const [environment, setEnvironment] =
    useState<EnvironmentType>('windows-local')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    builtInWorkflows[0].id,
  )
  const [result, setResult] = useState<AssistantResult>(initialResult)
  const [loading, setLoading] = useState(false)

  const activeTask = taskTypeOptions.find((item) => item.id === taskType) ?? initialTask

  const runWorkflow = async (nextTaskType = taskType, templateId = selectedTemplateId) => {
    setLoading(true)

    try {
      const nextResult = await resolveWorkflowAssistant({
        taskType: nextTaskType,
        input,
        preferredShell,
        environment,
        templateId,
      })
      setResult(nextResult)
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateUse = async (template: WorkflowTemplate) => {
    setTaskType('use-template')
    setSelectedTemplateId(template.id)
    setInput(template.samplePrompt)
    setEnvironment(template.recommendedEnvironment)
    await runWorkflow('use-template', template.id)
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Windows Terminal Workflow Assistant</p>
          <h1>面向 Windows 开发与运维场景的终端工作流面板。</h1>
          <p className="hero-text">
            当前版本用 mock 数据打通产品骨架，重点体现环境判断、跨 shell
            翻译、排障模板和风险提示，而不是做成通用聊天机器人。
          </p>
        </div>
        <div className="status-strip">
          <span>Windows-first</span>
          <span>PowerShell / cmd / WSL</span>
          <span>Tauri + React + TypeScript</span>
          <span>Mock Workflow Engine</span>
        </div>
      </section>

      <TaskTypeGrid
        options={taskTypeOptions}
        activeTask={taskType}
        onSelect={setTaskType}
      />

      <section className="workspace-grid">
        <div className="main-column">
          <ControlPanel
            activeTask={activeTask}
            input={input}
            preferredShell={preferredShell}
            environment={environment}
            selectedTemplateId={selectedTemplateId}
            templates={builtInWorkflows}
            loading={loading}
            onInputChange={setInput}
            onShellChange={setPreferredShell}
            onEnvironmentChange={setEnvironment}
            onTemplateChange={setSelectedTemplateId}
            onSubmit={() => {
              void runWorkflow()
            }}
          />
          <ResultPanel result={result} />
          <BuiltInTemplatePanel
            templates={builtInWorkflows}
            activeTemplateId={selectedTemplateId}
            onUseTemplate={(template) => {
              void handleTemplateUse(template)
            }}
          />
        </div>

        <RecentRecordPanel records={recentRecords} />
      </section>
    </main>
  )
}

export default App
