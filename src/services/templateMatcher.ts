import { workflowCatalog } from '../data/workflowCatalog'
import type {
  AssistantRequest,
  ConfidenceLevel,
  ScenarioId,
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

const getConfidence = (score: number): ConfidenceLevel => {
  if (score >= 10) {
    return 'high'
  }

  if (score >= 5) {
    return 'medium'
  }

  return 'low'
}

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
    return {
      matched: false,
      suggestedScenarioIds: [],
      matchedTerms: [],
      score: 0,
      confidence: 'low',
      reason: '当前没有可用于匹配的输入，请补充任务描述、错误信息或直接选择模板。',
    }
  }

  const candidates = workflowCatalog
    .map((entry) => scoreEntry(entry, request, normalizedInput))
    .sort((left, right) => right.score - left.score)

  const bestCandidate = candidates[0]

  if (!bestCandidate || bestCandidate.score < 5) {
    return {
      matched: false,
      suggestedScenarioIds: candidates
        .filter((candidate) => candidate.score > 0)
        .slice(0, 3)
        .map((candidate) => candidate.scenarioId),
      matchedTerms: bestCandidate?.matchedTerms ?? [],
      score: bestCandidate?.score ?? 0,
      confidence: bestCandidate ? getConfidence(bestCandidate.score) : 'low',
      reason:
        bestCandidate?.matchedTerms.length
          ? `输入里只命中了部分线索：${bestCandidate.matchedTerms.slice(0, 3).join('、')}，还不足以稳定落到一个模板。`
          : '这次输入没有稳定命中已有模板，请补充更明确的动作对象、报错关键词或执行环境。',
    }
  }

  return {
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
