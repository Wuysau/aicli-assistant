import { workflowCatalog } from '../data/workflowCatalog'
import { generateAiSupplement } from './aiSupplementService'
import { evaluateRiskRules } from './riskRuleEngine'
import { matchWorkflowTemplate } from './templateMatcher'
import type {
  AiSupplement,
  AiSupplementRequestPayload,
  AiSupplementTrigger,
  AppView,
  AssistantRequest,
  AssistantResult,
  CommandGenerationPayload,
  CommandSection,
  CommandVariant,
  EnvironmentJudgementPayload,
  EnvironmentSignal,
  ErrorAnalysisPayload,
  ListSection,
  ParagraphSection,
  RecentRecord,
  ResultBadge,
  RiskHint,
  ShellType,
  StepSection,
  TemplateMatchResult,
  WorkflowCatalogEntry,
  WorkflowResolution,
  WorkflowTemplatePayload,
} from '../types'

const workflowCatalogMap = new Map(
  workflowCatalog.map((entry) => [entry.template.id, entry]),
)

const environmentLabelMap = {
  'windows-local': 'Windows 本机',
  wsl: 'WSL / Bash',
  'remote-linux': '远程 Linux / SSH',
} as const

const riskLabelMap = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
} as const

const sortVariants = (variants: CommandVariant[], preferredShell: ShellType) =>
  [...variants].sort((left, right) => {
    if (left.shell === preferredShell) {
      return -1
    }

    if (right.shell === preferredShell) {
      return 1
    }

    return 0
  })

const dedupeRiskHints = (riskHints: RiskHint[]) => {
  const collected = new Map<string, RiskHint>()
  riskHints.forEach((risk) => collected.set(risk.id, risk))
  return Array.from(collected.values())
}

const dedupeStrings = (items: string[], maxItems = 4) =>
  Array.from(new Set(items.filter((item) => item.trim().length > 0))).slice(0, maxItems)

const createBadges = (
  request: AssistantRequest,
  entry: WorkflowCatalogEntry,
): ResultBadge[] => [
  { label: `当前 Shell：${request.preferredShell}`, tone: 'neutral' },
  {
    label: `推荐环境：${environmentLabelMap[entry.template.recommendedEnvironment]}`,
    tone: 'info',
  },
  {
    label: `风险等级：${riskLabelMap[entry.guide.riskLevel]}`,
    tone: entry.guide.riskLevel === 'low' ? 'neutral' : 'warning',
  },
]

const applyEnvironmentHint = (
  request: AssistantRequest,
  entry: WorkflowCatalogEntry,
  nextSteps: string[],
) =>
  request.environment === entry.template.recommendedEnvironment
    ? nextSteps
    : [
        `你当前选择的是 ${environmentLabelMap[request.environment]}，但这个场景更适合先在 ${environmentLabelMap[entry.template.recommendedEnvironment]} 中处理。`,
        ...nextSteps,
      ]

const collectTemplateCommands = (entry: WorkflowCatalogEntry) =>
  sortVariants(
    [
      entry.template.mainCommand,
      ...entry.template.alternateCommands,
      ...entry.template.steps.flatMap((item) => item.commands ?? []),
    ],
    entry.template.mainCommand.shell,
  )

const collectRiskHints = (entry: WorkflowCatalogEntry) => {
  const templateRisks = [
    ...entry.template.risks,
    ...entry.template.steps.flatMap((step) => (step.risk ? [step.risk] : [])),
  ]
  const ruleDrivenRisks = evaluateRiskRules(collectTemplateCommands(entry))
  return dedupeRiskHints([...templateRisks, ...ruleDrivenRisks])
}

const createSignals = (
  items: string[],
  tone: EnvironmentSignal['tone'],
): EnvironmentSignal[] =>
  items.map((detail, index) => ({
    id: `${tone}-${index}`,
    title: tone === 'supports' ? '支持信号' : '偏差信号',
    detail,
    tone,
  }))

const buildCommandVariants = (entry: WorkflowCatalogEntry, preferredShell: ShellType) =>
  sortVariants(
    [entry.template.mainCommand, ...entry.template.alternateCommands],
    preferredShell,
  )

const appendAiSupplement = (
  result: AssistantResult,
  supplement?: AiSupplement,
): AssistantResult => {
  if (!supplement) {
    return result
  }

  const nextSteps = dedupeStrings([
    ...result.nextSteps,
    ...supplement.recommendedNextSteps,
    ...supplement.safetyNotes,
  ])

  const sections = [...result.sections]

  if (supplement.summary) {
    sections.push({
      id: 'ai-supplement-summary',
      title: 'AI 补充说明',
      type: 'paragraph',
      paragraphs: [supplement.summary],
    } satisfies ParagraphSection)
  }

  if (supplement.explanationBullets.length > 0) {
    sections.push({
      id: 'ai-supplement-explanations',
      title: 'AI 补充解释',
      type: 'list',
      items: supplement.explanationBullets,
    } satisfies ListSection)
  }

  if (supplement.differenceNotes.length > 0) {
    sections.push({
      id: 'ai-supplement-differences',
      title: 'AI 补充差异说明',
      type: 'list',
      items: supplement.differenceNotes,
    } satisfies ListSection)
  }

  return {
    ...result,
    aiSupplement: supplement,
    recommendedEnvironment:
      supplement.environmentSuggestion ?? result.recommendedEnvironment,
    nextSteps,
    relatedTemplateIds: dedupeStrings(
      [...result.relatedTemplateIds, ...supplement.relatedTemplateIds],
      4,
    ) as AssistantResult['relatedTemplateIds'],
    sections,
  }
}

const createAiSupplementPayload = (
  request: AssistantRequest,
  trigger: AiSupplementTrigger,
  localResult: AssistantResult | undefined,
  match: WorkflowResolution['match'],
): AiSupplementRequestPayload => ({
  trigger,
  userInput: request.input,
  taskType: request.taskType,
  preferredShell: request.preferredShell,
  environment: request.environment,
  match,
  localResultSummary: localResult?.summary,
  localRecommendedEnvironment: localResult?.recommendedEnvironment,
  allowedTemplates: workflowCatalog.map((entry) => ({
    id: entry.template.id,
    title: entry.template.title,
    category: entry.template.category,
    summary: entry.template.summary,
    recommendedEnvironment: entry.template.recommendedEnvironment,
    supportedShells: entry.template.supportedShells,
  })),
})

const shouldRequestAiSupplement = (
  request: AssistantRequest,
  match: WorkflowResolution['match'],
  result?: AssistantResult,
): AiSupplementTrigger | undefined => {
  if (!request.input.trim()) {
    return undefined
  }

  if (!match.matched) {
    return 'no-result'
  }

  if (match.confidence === 'low') {
    return 'low-confidence'
  }

  if (
    result?.kind === 'command-generation' &&
    result.payload.type === 'command-generation' &&
    result.payload.differenceNotes.length < 2
  ) {
    return 'difference-notes'
  }

  return undefined
}

const buildCommandResult = (
  request: AssistantRequest,
  entry: WorkflowCatalogEntry,
): AssistantResult => {
  const commandVariants = buildCommandVariants(entry, request.preferredShell)
  const payload: CommandGenerationPayload = {
    type: 'command-generation',
    primaryScenarioId: entry.template.id,
    variants: commandVariants,
    differenceNotes: entry.guide.differenceNotes,
  }

  return {
    kind: 'command-generation',
    taskType: request.taskType,
    title: `${entry.template.title}命令建议`,
    summary: entry.guide.commandSummary,
    inputEcho: request.input,
    preferredShell: request.preferredShell,
    recommendedEnvironment: entry.template.recommendedEnvironment,
    riskLevel: entry.guide.riskLevel,
    badges: createBadges(request, entry),
    riskHints: collectRiskHints(entry),
    nextSteps: applyEnvironmentHint(request, entry, entry.guide.nextSteps),
    relatedTemplateIds: [entry.template.id],
    payload,
    sections: [
      {
        id: 'command-overview',
        title: '场景说明',
        type: 'paragraph',
        paragraphs: entry.template.explanation,
      } satisfies ParagraphSection,
      {
        id: 'command-variants',
        title: '其他写法',
        type: 'commands',
        variants: payload.variants,
      } satisfies CommandSection,
      {
        id: 'command-differences',
        title: '差异说明',
        type: 'list',
        items: payload.differenceNotes,
      } satisfies ListSection,
    ],
  }
}

const buildEnvironmentResult = (
  request: AssistantRequest,
  entry: WorkflowCatalogEntry,
): AssistantResult => {
  const commandVariants = buildCommandVariants(entry, request.preferredShell)
  const payload: EnvironmentJudgementPayload = {
    type: 'environment-judgement',
    primaryScenarioId: entry.template.id,
    confidence: 'high',
    recommendedShells: entry.guide.recommendedShells,
    reasoning: entry.guide.reasoning,
    supportingSignals: createSignals(entry.guide.supportingSignals, 'supports'),
    conflictingSignals: createSignals(entry.guide.conflictingSignals, 'warning'),
    handoffSteps: entry.guide.handoffSteps,
    variants: commandVariants,
  }

  return {
    kind: 'environment-judgement',
    taskType: request.taskType,
    title: `${entry.template.title}环境判断`,
    summary: entry.guide.environmentSummary,
    inputEcho: request.input,
    preferredShell: request.preferredShell,
    recommendedEnvironment: entry.template.recommendedEnvironment,
    riskLevel: entry.guide.riskLevel,
    badges: [
      ...createBadges(request, entry),
      { label: `判断置信度：${payload.confidence}`, tone: 'info' },
    ],
    riskHints: collectRiskHints(entry),
    nextSteps: applyEnvironmentHint(request, entry, [
      ...entry.guide.nextSteps,
      ...payload.handoffSteps,
    ]),
    relatedTemplateIds: [entry.template.id],
    payload,
    sections: [
      {
        id: 'environment-summary',
        title: '判断结论',
        type: 'paragraph',
        paragraphs: [entry.guide.environmentSummary, ...entry.template.explanation],
      } satisfies ParagraphSection,
      {
        id: 'environment-reasoning',
        title: '判断依据',
        type: 'list',
        items: payload.reasoning,
      } satisfies ListSection,
      {
        id: 'environment-shells',
        title: '推荐 Shell',
        type: 'tags',
        tags: payload.recommendedShells,
      },
      {
        id: 'environment-commands',
        title: '对应写法',
        type: 'commands',
        variants: payload.variants,
      } satisfies CommandSection,
    ],
  }
}

const buildErrorResult = (
  request: AssistantRequest,
  entry: WorkflowCatalogEntry,
): AssistantResult => {
  const quickChecks = sortVariants(
    entry.template.steps.flatMap((step) => step.commands ?? []).slice(0, 4),
    request.preferredShell,
  )
  const payload: ErrorAnalysisPayload = {
    type: 'error-analysis',
    primaryScenarioId: entry.template.id,
    probableCauses: entry.guide.probableCauses,
    investigationSteps: entry.template.steps.map((step) => ({
      ...step,
      commands: step.commands ? sortVariants(step.commands, request.preferredShell) : undefined,
    })),
    quickChecks,
  }

  return {
    kind: 'error-analysis',
    taskType: request.taskType,
    title: `${entry.template.title}排查建议`,
    summary: entry.guide.errorSummary,
    inputEcho: request.input,
    preferredShell: request.preferredShell,
    recommendedEnvironment: entry.template.recommendedEnvironment,
    riskLevel: entry.guide.riskLevel,
    badges: createBadges(request, entry),
    riskHints: collectRiskHints(entry),
    nextSteps: applyEnvironmentHint(request, entry, entry.guide.nextSteps),
    relatedTemplateIds: [entry.template.id],
    payload,
    sections: [
      {
        id: 'error-summary',
        title: '问题拆解',
        type: 'paragraph',
        paragraphs: [entry.guide.errorSummary, ...entry.template.explanation],
      } satisfies ParagraphSection,
      {
        id: 'error-causes',
        title: '可能原因',
        type: 'list',
        items: payload.probableCauses,
      } satisfies ListSection,
      {
        id: 'error-steps',
        title: '排查步骤',
        type: 'steps',
        steps: payload.investigationSteps,
      } satisfies StepSection,
      {
        id: 'error-quick-checks',
        title: '快速检查命令',
        type: 'commands',
        variants: payload.quickChecks,
      } satisfies CommandSection,
    ],
  }
}

const buildTemplateResult = (
  request: AssistantRequest,
  entry: WorkflowCatalogEntry,
): AssistantResult => {
  const starterCommands = buildCommandVariants(entry, request.preferredShell)
  const payload: WorkflowTemplatePayload = {
    type: 'workflow-template',
    template: {
      ...entry.template,
      alternateCommands: sortVariants(entry.template.alternateCommands, request.preferredShell),
      steps: entry.template.steps.map((step) => ({
        ...step,
        commands: step.commands ? sortVariants(step.commands, request.preferredShell) : undefined,
      })),
    },
    starterCommands,
  }

  return {
    kind: 'workflow-template',
    taskType: request.taskType,
    title: `${entry.template.title}模板`,
    summary: entry.template.summary,
    inputEcho: request.input || entry.template.samplePrompt,
    preferredShell: request.preferredShell,
    recommendedEnvironment: entry.template.recommendedEnvironment,
    riskLevel: entry.guide.riskLevel,
    badges: createBadges(request, entry),
    riskHints: collectRiskHints(entry),
    nextSteps: applyEnvironmentHint(request, entry, entry.guide.nextSteps),
    relatedTemplateIds: [entry.template.id],
    payload,
    sections: [
      {
        id: 'template-summary',
        title: '模板说明',
        type: 'paragraph',
        paragraphs: [entry.template.summary, ...entry.template.explanation],
      } satisfies ParagraphSection,
      {
        id: 'template-tags',
        title: '标签',
        type: 'tags',
        tags: entry.template.tags,
      },
      {
        id: 'template-steps',
        title: '模板步骤',
        type: 'steps',
        steps: payload.template.steps,
      } satisfies StepSection,
      {
        id: 'template-commands',
        title: '推荐命令与备选写法',
        type: 'commands',
        variants: payload.starterCommands,
      } satisfies CommandSection,
    ],
  }
}

export const createRecentRecordFromResult = (
  request: AssistantRequest,
  result: AssistantResult,
  match: TemplateMatchResult,
  sourceView: AppView,
): RecentRecord => {
  const createdAt = new Date().toISOString()

  return {
    id: `record-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    taskType: request.taskType,
    scenarioId: result.relatedTemplateIds[0],
    title: result.title,
    summary: result.summary,
    timestamp: new Date().toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    createdAt,
    preferredShell: request.preferredShell,
    environment: request.environment,
    recommendedEnvironment: result.recommendedEnvironment,
    riskLevel: result.riskLevel,
    sourceView,
    requestSnapshot: request,
    matchSnapshot: match,
    resultSnapshot: result,
  }
}

export async function resolveWorkflowAssistant(
  request: AssistantRequest,
): Promise<WorkflowResolution> {
  const delay = Number(import.meta.env.VITE_MOCK_DELAY_MS ?? 320)
  const match = matchWorkflowTemplate(request)

  await new Promise((resolve) => window.setTimeout(resolve, delay))

  if (
    (import.meta.env.DEV || import.meta.env.MODE === 'test' || import.meta.env.VITEST) &&
    request.input.includes('__DEV_THROW__')
  ) {
    throw new Error('Development verification error')
  }

  if (!match.matched || !match.scenarioId) {
    const trigger = shouldRequestAiSupplement(request, match)
    const aiSupplement = trigger
      ? await generateAiSupplement(
          createAiSupplementPayload(request, trigger, undefined, match),
        )
      : undefined

    return {
      result: undefined,
      match,
      aiSupplement,
    }
  }

  const entry = workflowCatalogMap.get(match.scenarioId)

  if (!entry) {
    return {
      result: undefined,
      match: {
        matched: false,
        scenarioId: undefined,
        suggestedScenarioIds: [],
        matchedTerms: [],
        score: 0,
        confidence: 'low',
        reason: '模板目录中没有找到对应场景，请从模板库手动选择。',
      },
    }
  }

  let result: AssistantResult

  if (request.taskType === 'generate-command') {
    result = buildCommandResult(request, entry)
  } else if (request.taskType === 'judge-environment') {
    result = buildEnvironmentResult(request, entry)
  } else if (request.taskType === 'analyze-error') {
    result = buildErrorResult(request, entry)
  } else {
    result = buildTemplateResult(request, entry)
  }

  const trigger = shouldRequestAiSupplement(request, match, result)
  const aiSupplement = trigger
    ? await generateAiSupplement(createAiSupplementPayload(request, trigger, result, match))
    : undefined

  return {
    result: appendAiSupplement(result, aiSupplement),
    match,
    aiSupplement,
  }
}
