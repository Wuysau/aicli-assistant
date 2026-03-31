import { workflowCatalog } from '../data/workflowCatalog'
import type {
  AssistantRequest,
  ConfidenceLevel,
  ScenarioId,
  TemplateMatchCategory,
  TemplateMatchResult,
  WorkflowCatalogEntry,
} from '../types'

interface ScoredCandidate {
  scenarioId: ScenarioId
  score: number
  matchedTerms: string[]
}

const normalizeText = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ')

const offTopicPatterns = [
  /你是什么模型/,
  /你是.?谁/,
  /介绍(一下)?你自己/,
  /你能做什么/,
  /你是(gpt|chatgpt)/,
  /what model are you/,
  /who are you/,
  /introduce yourself/,
]

const getConfidence = (score: number): ConfidenceLevel => {
  if (score >= 10) {
    return 'high'
  }

  if (score >= 5) {
    return 'medium'
  }

  return 'low'
}

const createNoMatchResult = (
  category: TemplateMatchCategory,
  reason: string,
  overrides?: Partial<
    Pick<TemplateMatchResult, 'suggestedScenarioIds' | 'matchedTerms' | 'score' | 'confidence'>
  >,
): TemplateMatchResult => ({
  category,
  matched: false,
  suggestedScenarioIds: overrides?.suggestedScenarioIds ?? [],
  matchedTerms: overrides?.matchedTerms ?? [],
  score: overrides?.score ?? 0,
  confidence: overrides?.confidence ?? 'low',
  reason,
})

const isOffTopicInput = (normalizedInput: string) =>
  offTopicPatterns.some((pattern) => pattern.test(normalizedInput))

const scoreEntry = (
  entry: WorkflowCatalogEntry,
  request: AssistantRequest,
  normalizedInput: string,
): ScoredCandidate => {
  let score = 0
  const matchedTerms: string[] = []

  const fields = [
    { terms: [entry.template.title], weight: 6 },
    { terms: entry.template.aliases, weight: 5 },
    { terms: entry.intent.aliases, weight: 4 },
    { terms: entry.intent.naturalPhrases, weight: 4 },
    { terms: entry.intent.keywords, weight: 3 },
    { terms: entry.template.tags, weight: 2 },
    { terms: entry.template.promptExamples, weight: 2 },
    { terms: entry.intent.commandHints, weight: 2 },
    { terms: [entry.template.mainCommand.command], weight: 1 },
  ]

  fields.forEach(({ terms, weight }) => {
    terms.forEach((term) => {
      const normalizedTerm = normalizeText(term)

      if (!normalizedTerm) {
        return
      }

      if (normalizedInput.includes(normalizedTerm)) {
        score += weight
        matchedTerms.push(term)
      }
    })
  })

  if (entry.intent.taskTypeBoosts.includes(request.taskType)) {
    score += 1
  }

  if (entry.template.supportedShells.includes(request.preferredShell)) {
    score += 1
  }

  if (request.environment === entry.template.recommendedEnvironment) {
    score += 1
  }

  return {
    scenarioId: entry.template.id,
    score,
    matchedTerms: Array.from(new Set(matchedTerms)),
  }
}

export const matchWorkflowTemplate = (
  request: AssistantRequest,
): TemplateMatchResult => {
  if (request.taskType === 'use-template' && request.templateId) {
    return {
      category: 'manual-template',
      matched: true,
      scenarioId: request.templateId,
      suggestedScenarioIds: [request.templateId],
      matchedTerms: ['manual-template-selection'],
      score: 12,
      confidence: 'high',
      reason: '你已经手动选择了模板，这次直接进入对应工作流。',
    }
  }

  const normalizedInput = normalizeText(request.input)

  if (!normalizedInput) {
    return createNoMatchResult(
      'empty-input',
      '当前没有可用于匹配的输入，请补充任务描述、错误信息，或直接从模板库进入具体场景。',
    )
  }

  if (isOffTopicInput(normalizedInput)) {
    return createNoMatchResult(
      'off-topic',
      '这次输入是在询问助手身份或通用信息，不属于终端命令、报错排查或环境判断任务。',
    )
  }

  const candidates = workflowCatalog
    .map((entry) => scoreEntry(entry, request, normalizedInput))
    .sort((left, right) => right.score - left.score)

  const bestCandidate = candidates[0]

  if (!bestCandidate || bestCandidate.score < 5) {
    return createNoMatchResult(
      'insufficient-match',
      bestCandidate?.matchedTerms.length
        ? `输入里只命中了部分线索：${bestCandidate.matchedTerms.slice(0, 3).join('、')}，还不足以稳定落到一个模板。`
        : '这次输入没有稳定命中已有模板，请补充更明确的动作对象、报错关键词或执行环境。',
      {
        suggestedScenarioIds: candidates
          .filter((candidate) => candidate.score > 0)
          .slice(0, 3)
          .map((candidate) => candidate.scenarioId),
        matchedTerms: bestCandidate?.matchedTerms ?? [],
        score: bestCandidate?.score ?? 0,
        confidence: bestCandidate ? getConfidence(bestCandidate.score) : 'low',
      },
    )
  }

  return {
    category: 'matched',
    matched: true,
    scenarioId: bestCandidate.scenarioId,
    suggestedScenarioIds: candidates.slice(0, 3).map((candidate) => candidate.scenarioId),
    matchedTerms: bestCandidate.matchedTerms,
    score: bestCandidate.score,
    confidence: getConfidence(bestCandidate.score),
    reason:
      bestCandidate.matchedTerms.length > 0
        ? `因为输入里命中了 ${bestCandidate.matchedTerms.slice(0, 3).join('、')}，所以优先推荐了对应模板。`
        : '结合任务类型、当前环境和 Shell 偏好，匹配到了最接近的模板。',
  }
}
