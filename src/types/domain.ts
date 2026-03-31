export type ShellType = 'powershell' | 'cmd' | 'bash' | 'wsl'

export type EnvironmentType = 'windows-local' | 'wsl' | 'remote-linux'

export type TaskType =
  | 'generate-command'
  | 'analyze-error'
  | 'judge-environment'
  | 'use-template'

export type RiskLevel = 'low' | 'medium' | 'high'

export type ResultKind =
  | 'command-generation'
  | 'error-analysis'
  | 'environment-judgement'
  | 'workflow-template'

export interface TaskTypeOption {
  id: TaskType
  title: string
  description: string
  inputLabel: string
  placeholder: string
}

export interface EnvironmentOption {
  id: EnvironmentType
  label: string
  description: string
}

export interface CommandVariant {
  shell: ShellType
  label: string
  command: string
  available: boolean
  notes?: string
}

export interface RiskHint {
  id: string
  level: RiskLevel
  title: string
  detail: string
  saferAlternative?: string
}

export interface WorkflowStep {
  id: string
  title: string
  detail: string
  environment: EnvironmentType
  commands?: CommandVariant[]
  risk?: RiskHint
}

export interface WorkflowTemplate {
  id: string
  name: string
  category: string
  description: string
  recommendedEnvironment: EnvironmentType
  supportedShells: ShellType[]
  tags: string[]
  samplePrompt: string
  steps: WorkflowStep[]
}

export interface RecentRecord {
  id: string
  taskType: TaskType
  title: string
  summary: string
  timestamp: string
  preferredShell: ShellType
  environment: EnvironmentType
}

export interface AssistantRequest {
  taskType: TaskType
  input: string
  preferredShell: ShellType
  environment: EnvironmentType
  templateId?: string
}

interface BaseAssistantResult {
  kind: ResultKind
  taskType: TaskType
  title: string
  summary: string
  recommendedEnvironment: EnvironmentType
  risks: RiskHint[]
  nextSteps: string[]
}

export interface CrossShellCommandResult extends BaseAssistantResult {
  kind: 'command-generation'
  variants: CommandVariant[]
  differenceNotes: string[]
}

export interface EnvironmentJudgementResult extends BaseAssistantResult {
  kind: 'environment-judgement'
  confidence: 'high' | 'medium' | 'low'
  reasoning: string[]
  variants: CommandVariant[]
}

export interface ErrorAnalysisResult extends BaseAssistantResult {
  kind: 'error-analysis'
  probableCauses: string[]
  investigationSteps: WorkflowStep[]
  quickChecks: CommandVariant[]
}

export interface WorkflowTemplateResult extends BaseAssistantResult {
  kind: 'workflow-template'
  template: WorkflowTemplate
  starterCommands: CommandVariant[]
}

export type AssistantResult =
  | CrossShellCommandResult
  | EnvironmentJudgementResult
  | ErrorAnalysisResult
  | WorkflowTemplateResult
