import { describe, expect, it } from 'vitest'
import { riskRuleCases } from '../data/riskRuleCases'
import { scenarioVerificationPacks, verificationCases } from '../data/verificationCases'
import { evaluateRiskRules } from '../services/riskRuleEngine'
import { runVerificationCase } from '../services/verificationRunner'
import type {
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
