import { builtInWorkflows } from '../data/builtInWorkflows'
import { scenarioVerificationPacks } from '../data/verificationCases'
import type {
  AssistantRequest,
  ScenarioId,
  ScenarioVerificationPack,
  VerificationCase,
  VerificationOutcome,
} from '../types'
import { resolveWorkflowAssistant } from './workflowAssistantService'

const templateMap = new Map(builtInWorkflows.map((template) => [template.id, template]))
const verificationPackMap = new Map(
  scenarioVerificationPacks.map((pack) => [pack.scenarioId, pack]),
)

export const toVerificationRequest = (
  testCase: VerificationCase,
): AssistantRequest => ({
  taskType: testCase.taskType,
  input: testCase.input,
  preferredShell: testCase.preferredShell,
  environment: testCase.environment,
  templateId: testCase.templateId,
})

export const getVerificationPack = (
  scenarioId?: ScenarioId,
): ScenarioVerificationPack | undefined =>
  scenarioId ? verificationPackMap.get(scenarioId) : undefined

const getExpectedPass = (
  testCase: VerificationCase,
  outcome: Omit<VerificationOutcome, 'expectedPass' | 'testCase'>,
) => {
  if (testCase.expectedError) {
    return outcome.status === 'error'
  }

  if (!testCase.expectedMatched) {
    return outcome.status === 'no-result'
  }

  const expectedPack = getVerificationPack(testCase.expectedScenarioId)

  return (
    outcome.status === 'success' &&
    outcome.actualScenarioId === testCase.expectedScenarioId &&
    outcome.recommendedEnvironment ===
      (testCase.expectedRecommendedEnvironment ??
        expectedPack?.expectedRecommendedEnvironment) &&
    outcome.riskLevel ===
      (testCase.expectedRiskLevel ?? expectedPack?.expectedRiskLevel) &&
    outcome.actualScenarioSource ===
      (testCase.expectedTemplateSource ?? expectedPack?.expectedTemplateSource)
  )
}

export async function runVerificationCase(
  testCase: VerificationCase,
): Promise<VerificationOutcome> {
  try {
    const resolution = await resolveWorkflowAssistant(toVerificationRequest(testCase))

    if (!resolution.result) {
      const noResultOutcome: Omit<VerificationOutcome, 'expectedPass' | 'testCase'> = {
        status: 'no-result',
        matched: resolution.match.matched,
      }

      return {
        testCase,
        ...noResultOutcome,
        expectedPass: getExpectedPass(testCase, noResultOutcome),
      }
    }

    const actualTemplate = resolution.match.scenarioId
      ? templateMap.get(resolution.match.scenarioId)
      : undefined

    const successOutcome: Omit<VerificationOutcome, 'expectedPass' | 'testCase'> = {
      status: 'success',
      matched: resolution.match.matched,
      actualScenarioId: resolution.match.scenarioId,
      actualScenarioTitle: actualTemplate?.title,
      actualScenarioSource: actualTemplate?.source,
      recommendedEnvironment: resolution.result.recommendedEnvironment,
      riskLevel: resolution.result.riskLevel,
    }

    return {
      testCase,
      ...successOutcome,
      expectedPass: getExpectedPass(testCase, successOutcome),
    }
  } catch (error) {
    const errorOutcome: Omit<VerificationOutcome, 'expectedPass' | 'testCase'> = {
      status: 'error',
      matched: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    }

    return {
      testCase,
      ...errorOutcome,
      expectedPass: getExpectedPass(testCase, errorOutcome),
    }
  }
}
