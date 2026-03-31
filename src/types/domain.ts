export type AppView =
  | 'workbench'
  | 'template-library'
  | 'environment-lab'
  | 'settings'
  | 'verification-lab'

export type ShellType = 'powershell' | 'cmd' | 'wsl' | 'bash'

export type EnvironmentType = 'windows-local' | 'wsl' | 'remote-linux'

export type TaskType =
  | 'generate-command'
  | 'analyze-error'
  | 'judge-environment'
  | 'use-template'

export type RiskLevel = 'low' | 'medium' | 'high'

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export type TemplateMatchCategory =
  | 'matched'
  | 'manual-template'
  | 'empty-input'
  | 'insufficient-match'
  | 'off-topic'

export type ResultKind =
  | 'command-generation'
  | 'error-analysis'
  | 'environment-judgement'
  | 'workflow-template'

export type ScenarioId =
  | 'port-occupancy'
  | 'kill-process'
  | 'count-log-signals'
  | 'maven-package-skip-tests'
  | 'git-user-email'
  | 'git-push-hook-rejected'
  | 'java-port-conflict'
  | 'powershell-execution-policy'
  | 'ssh-connection-basic'
  | 'docker-container-status'

export type RiskImpactScope =
  | 'current-command'
  | 'current-repo'
  | 'current-machine'
  | 'remote-host'

export type RiskReversibility = 'easy' | 'partial' | 'hard'

export type RiskRuleId =
  | 'destructive-delete'
  | 'git-force-push'
  | 'git-hard-reset'
  | 'docker-cleanup'
  | 'overwrite-output'

export type TemplateSource = 'local-structured-template-library'

export type TemplateSortMode = 'default' | 'recent' | 'frequent'

export type RecentSearchSource = 'template-library' | 'workbench'

export type AiMode = 'rules-only' | 'supplemental'

export type AiProviderType =
  | 'openai-compatible'
  | 'ollama'
  | 'anthropic-compatible'

export type AiSupplementTrigger =
  | 'no-result'
  | 'low-confidence'
  | 'difference-notes'

export type VerificationCaseKind = 'standard' | 'fuzzy' | 'no-result' | 'error'

export type AssistantViewStatus =
  | 'idle'
  | 'loading'
  | 'empty'
  | 'no-result'
  | 'error'
  | 'success'

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

export interface AppViewOption {
  id: AppView
  label: string
  description: string
}

export interface ResultBadge {
  label: string
  tone: 'neutral' | 'info' | 'warning'
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
  reason: string
  impact: string
  impactScope: RiskImpactScope
  reversibility: RiskReversibility
  saferAlternative?: string
}

export interface RiskRuleDefinition {
  id: RiskRuleId
  title: string
  level: RiskLevel
  patterns: RegExp[]
  reason: string
  impact: string
  impactScope: RiskImpactScope
  reversibility: RiskReversibility
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
  id: ScenarioId
  title: string
  aliases: string[]
  source: TemplateSource
  category: string
  summary: string
  recommendedEnvironment: EnvironmentType
  supportedShells: ShellType[]
  mainCommand: CommandVariant
  alternateCommands: CommandVariant[]
  explanation: string[]
  risks: RiskHint[]
  tags: string[]
  samplePrompt: string
  promptExamples: string[]
  steps: WorkflowStep[]
}

export interface WorkflowIntentProfile {
  keywords: string[]
  aliases: string[]
  naturalPhrases: string[]
  commandHints: string[]
  taskTypeBoosts: TaskType[]
}

export interface WorkflowGuideProfile {
  commandSummary: string
  environmentSummary: string
  errorSummary: string
  reasoning: string[]
  supportingSignals: string[]
  conflictingSignals: string[]
  probableCauses: string[]
  differenceNotes: string[]
  nextSteps: string[]
  handoffSteps: string[]
  riskLevel: RiskLevel
  recommendedShells: ShellType[]
}

export interface WorkflowCatalogEntry {
  template: WorkflowTemplate
  intent: WorkflowIntentProfile
  guide: WorkflowGuideProfile
}

export interface TemplateFilterState {
  query: string
  category: string
  environment: EnvironmentType | 'all'
}

export interface TemplateActivity {
  scenarioId: ScenarioId
  usageCount: number
  matchCount: number
  lastUsedAt?: string
  lastMatchedAt?: string
}

export interface RecentSearchKeyword {
  id: string
  query: string
  source: RecentSearchSource
  createdAt: string
}

export interface UserPreferences {
  preferredShell: ShellType
  environment: EnvironmentType
  taskType: TaskType
  selectedTemplateId?: ScenarioId
  templateLibraryFilter: TemplateFilterState
  templateLibrarySortMode: TemplateSortMode
}

export interface EnvironmentSignal {
  id: string
  title: string
  detail: string
  tone: 'supports' | 'warning'
}

export interface RecentRecord {
  id: string
  taskType: TaskType
  scenarioId?: ScenarioId
  title: string
  summary: string
  timestamp: string
  createdAt: string
  preferredShell: ShellType
  environment: EnvironmentType
  recommendedEnvironment: EnvironmentType
  riskLevel: RiskLevel
  sourceView: AppView
  requestSnapshot?: AssistantRequest
  matchSnapshot?: TemplateMatchResult
  resultSnapshot?: AssistantResult
}

export interface LocalAppStore {
  schemaVersion: 1
  updatedAt: string
  recentRecords: RecentRecord[]
  templateActivities: TemplateActivity[]
  recentSearchKeywords: RecentSearchKeyword[]
  preferences: UserPreferences
}

export interface AssistantRequest {
  taskType: TaskType
  input: string
  preferredShell: ShellType
  environment: EnvironmentType
  templateId?: ScenarioId
}

export interface TemplateMatchResult {
  category: TemplateMatchCategory
  matched: boolean
  scenarioId?: ScenarioId
  suggestedScenarioIds: ScenarioId[]
  matchedTerms: string[]
  score: number
  confidence: ConfidenceLevel
  reason: string
}

export interface AiSupplement {
  trigger: AiSupplementTrigger
  summary: string
  explanationBullets: string[]
  environmentSuggestion?: EnvironmentType
  relatedTemplateIds: ScenarioId[]
  recommendedNextSteps: string[]
  differenceNotes: string[]
  safetyNotes: string[]
}

export interface AiProviderHeader {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface AiProviderConfig {
  id: string
  type: AiProviderType
  name: string
  enabled: boolean
  isDefault: boolean
  baseUrl: string
  apiKey?: string
  model: string
  customHeaders: AiProviderHeader[]
  createdAt: string
  updatedAt: string
}

export interface AiProviderStore {
  schemaVersion: 1
  mode: AiMode
  defaultProviderId?: string
  providers: AiProviderConfig[]
  updatedAt: string
}

export interface AiProviderTestResult {
  success: boolean
  providerId: string
  providerName: string
  providerType: AiProviderType
  message: string
  checkedAt: string
}

export interface AiRuntimeStatus {
  enabled: boolean
  configured: boolean
  available: boolean
  mode: AiMode
  model?: string
  providerCount: number
  defaultProviderId?: string
  defaultProviderName?: string
  defaultProviderType?: AiProviderType
  message: string
}

export interface AiSupplementRequestPayload {
  trigger: AiSupplementTrigger
  userInput: string
  taskType: TaskType
  preferredShell: ShellType
  environment: EnvironmentType
  match: TemplateMatchResult
  localResultSummary?: string
  localRecommendedEnvironment?: EnvironmentType
  allowedTemplates: Array<{
    id: ScenarioId
    title: string
    category: string
    summary: string
    recommendedEnvironment: EnvironmentType
    supportedShells: ShellType[]
  }>
}

export interface CommandGenerationPayload {
  type: 'command-generation'
  primaryScenarioId?: ScenarioId
  variants: CommandVariant[]
  differenceNotes: string[]
}

export interface EnvironmentJudgementPayload {
  type: 'environment-judgement'
  primaryScenarioId?: ScenarioId
  confidence: ConfidenceLevel
  recommendedShells: ShellType[]
  reasoning: string[]
  supportingSignals: EnvironmentSignal[]
  conflictingSignals: EnvironmentSignal[]
  handoffSteps: string[]
  variants: CommandVariant[]
}

export interface ErrorAnalysisPayload {
  type: 'error-analysis'
  primaryScenarioId?: ScenarioId
  probableCauses: string[]
  investigationSteps: WorkflowStep[]
  quickChecks: CommandVariant[]
}

export interface WorkflowTemplatePayload {
  type: 'workflow-template'
  template: WorkflowTemplate
  starterCommands: CommandVariant[]
}

export type AssistantPayload =
  | CommandGenerationPayload
  | EnvironmentJudgementPayload
  | ErrorAnalysisPayload
  | WorkflowTemplatePayload

export interface ParagraphSection {
  id: string
  title: string
  type: 'paragraph'
  paragraphs: string[]
}

export interface ListSection {
  id: string
  title: string
  type: 'list'
  items: string[]
}

export interface CommandSection {
  id: string
  title: string
  type: 'commands'
  variants: CommandVariant[]
}

export interface StepSection {
  id: string
  title: string
  type: 'steps'
  steps: WorkflowStep[]
}

export interface TagSection {
  id: string
  title: string
  type: 'tags'
  tags: string[]
}

export type ResultSection =
  | ParagraphSection
  | ListSection
  | CommandSection
  | StepSection
  | TagSection

export interface AssistantResult {
  kind: ResultKind
  taskType: TaskType
  title: string
  summary: string
  inputEcho?: string
  preferredShell: ShellType
  recommendedEnvironment: EnvironmentType
  riskLevel: RiskLevel
  badges: ResultBadge[]
  riskHints: RiskHint[]
  nextSteps: string[]
  relatedTemplateIds: ScenarioId[]
  aiSupplement?: AiSupplement
  payload: AssistantPayload
  sections: ResultSection[]
}

export interface ViewStateCard {
  title: string
  summary: string
  hints: string[]
  tone: 'neutral' | 'info' | 'warning' | 'error'
}

export type AssistantViewState =
  | { status: 'idle'; card: ViewStateCard }
  | { status: 'loading'; card: ViewStateCard }
  | { status: 'empty'; card: ViewStateCard }
  | {
      status: 'no-result'
      card: ViewStateCard
      match: TemplateMatchResult
      aiSupplement?: AiSupplement
    }
  | { status: 'error'; card: ViewStateCard }
  | { status: 'success'; result: AssistantResult; match: TemplateMatchResult }

export interface WorkflowResolution {
  result?: AssistantResult
  match: TemplateMatchResult
  aiSupplement?: AiSupplement
}

export interface VerificationCase {
  id: string
  title: string
  kind: VerificationCaseKind
  input: string
  taskType: TaskType
  preferredShell: ShellType
  environment: EnvironmentType
  templateId?: ScenarioId
  expectedScenarioId?: ScenarioId
  expectedRecommendedEnvironment?: EnvironmentType
  expectedRiskLevel?: RiskLevel
  expectedTemplateSource?: TemplateSource
  expectedMatched: boolean
  expectedError?: boolean
  notes?: string
}

export interface ScenarioVerificationPack {
  scenarioId: ScenarioId
  title: string
  expectedRecommendedEnvironment: EnvironmentType
  expectedRiskLevel: RiskLevel
  expectedTemplateSource: TemplateSource
  expressions: string[]
  cases: VerificationCase[]
}

export interface VerificationOutcome {
  status: 'success' | 'no-result' | 'error'
  testCase: VerificationCase
  matched: boolean
  expectedPass: boolean
  actualScenarioId?: ScenarioId
  actualScenarioTitle?: string
  actualScenarioSource?: TemplateSource
  recommendedEnvironment?: EnvironmentType
  riskLevel?: RiskLevel
  errorMessage?: string
}

export interface RiskRuleVerificationCase {
  id: string
  title: string
  command: string
  expectedRuleIds: RiskRuleId[]
  expectedHighestLevel: RiskLevel
}
