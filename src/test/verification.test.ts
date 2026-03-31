import { describe, expect, it } from 'vitest'
import { riskRuleCases } from '../data/riskRuleCases'
import { scenarioVerificationPacks, verificationCases } from '../data/verificationCases'
import { resetProviderForType } from '../services/aiSupplementService'
import { evaluateRiskRules } from '../services/riskRuleEngine'
import { matchWorkflowTemplate } from '../services/templateMatcher'
import { runVerificationCase } from '../services/verificationRunner'
import type {
  AiProviderConfig,
  CommandVariant,
  RiskRuleVerificationCase,
  VerificationCase,
} from '../types'

const successCases = verificationCases.filter(
  (item) => item.expectedMatched && !item.expectedError,
)
const noResultCase = verificationCases.find((item) => !item.expectedMatched && !item.expectedError)
const errorCase = verificationCases.find((item) => item.expectedError)

describe('verification data coverage', () => {
  it('contains 10 scenario verification packs', () => {
    expect(scenarioVerificationPacks).toHaveLength(10)
  })

  it('gives each scenario 3 to 5 common expressions', () => {
    scenarioVerificationPacks.forEach((pack) => {
      expect(pack.expressions.length).toBeGreaterThanOrEqual(3)
      expect(pack.expressions.length).toBeLessThanOrEqual(5)
    })
  })
})

describe('workflow verification runner', () => {
  it.each(successCases)('matches expected template for $title', async (testCase: VerificationCase) => {
    const outcome = await runVerificationCase(testCase)

    expect(outcome.expectedPass, JSON.stringify(outcome)).toBe(true)
    expect(outcome.status).toBe('success')
    expect(outcome.actualScenarioId).toBe(testCase.expectedScenarioId)
  })

  it('returns no-result for unmatched input', async () => {
    expect(noResultCase).toBeDefined()
    const outcome = await runVerificationCase(noResultCase as VerificationCase)

    expect(outcome.expectedPass, JSON.stringify(outcome)).toBe(true)
    expect(outcome.status).toBe('no-result')
  })

  it('returns error for development error input', async () => {
    expect(errorCase).toBeDefined()
    const outcome = await runVerificationCase(errorCase as VerificationCase)

    expect(outcome.expectedPass, JSON.stringify(outcome)).toBe(true)
    expect(outcome.status).toBe('error')
  })
})

describe('template matcher guards', () => {
  it('marks general model identity questions as off-topic', () => {
    const match = matchWorkflowTemplate({
      taskType: 'generate-command',
      input: '你是什么模型',
      preferredShell: 'powershell',
      environment: 'windows-local',
    })

    expect(match.matched).toBe(false)
    expect(match.category).toBe('off-topic')
  })

  it('keeps manual template selection scoped to explicit use-template requests', () => {
    const match = matchWorkflowTemplate({
      taskType: 'generate-command',
      input: '随便写点别的',
      preferredShell: 'powershell',
      environment: 'windows-local',
      templateId: 'port-occupancy',
    })

    expect(match.category).not.toBe('manual-template')
    expect(match.scenarioId).not.toBe('port-occupancy')
  })
})

describe('risk rule engine', () => {
  it.each(riskRuleCases)('detects $title', (testCase: RiskRuleVerificationCase) => {
    const command: CommandVariant = {
      shell: 'bash',
      label: 'Test',
      command: testCase.command,
      available: true,
    }
    const result = evaluateRiskRules([command])
    const ruleIds = result.map((item) => item.id.replace('rule-', ''))
    const highestLevel = result.some((item) => item.level === 'high')
      ? 'high'
      : result.some((item) => item.level === 'medium')
        ? 'medium'
        : 'low'

    expect(ruleIds).toEqual(testCase.expectedRuleIds)
    expect(highestLevel).toBe(testCase.expectedHighestLevel)
  })
})

describe('AI provider helpers', () => {
  it('falls back to type-specific defaults when switching to ollama', () => {
    const provider: AiProviderConfig = {
      id: 'provider-1',
      type: 'openai-compatible',
      name: 'DashScope',
      enabled: true,
      isDefault: true,
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'sk-secret',
      model: 'qwen-plus-2025-07-28',
      customHeaders: [],
      createdAt: '0',
      updatedAt: '0',
    }

    const nextProvider = resetProviderForType(provider, 'ollama')

    expect(nextProvider.type).toBe('ollama')
    expect(nextProvider.baseUrl).toBe('http://127.0.0.1:11434')
    expect(nextProvider.model).toBe('qwen2.5:7b')
    expect(nextProvider.apiKey).toBe('')
  })

  it('falls back to openai-compatible defaults when switching back', () => {
    const provider: AiProviderConfig = {
      id: 'provider-2',
      type: 'ollama',
      name: 'Local Ollama',
      enabled: true,
      isDefault: false,
      baseUrl: 'http://127.0.0.1:11434',
      apiKey: '',
      model: 'llama3.1:8b',
      customHeaders: [],
      createdAt: '0',
      updatedAt: '0',
    }

    const nextProvider = resetProviderForType(provider, 'openai-compatible')

    expect(nextProvider.type).toBe('openai-compatible')
    expect(nextProvider.baseUrl).toBe('https://api.openai.com/v1')
    expect(nextProvider.model).toBe('gpt-4.1-mini')
    expect(nextProvider.apiKey).toBe('')
  })
})
