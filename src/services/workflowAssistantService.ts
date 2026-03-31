import { builtInWorkflows } from '../data/builtInWorkflows'
import {
  commandGenerationMocks,
  environmentJudgementMocks,
  errorAnalysisMocks,
  workflowTemplateMocks,
} from '../mock/mockCatalog'
import type {
  AssistantRequest,
  AssistantResult,
  CommandVariant,
  WorkflowTemplate,
} from '../types'

const defaultTemplate = builtInWorkflows[0]

const includesAny = (input: string, keywords: string[]) =>
  keywords.some((keyword) => input.includes(keyword))

const chooseCommandMock = (input: string) => {
  if (includesAny(input, ['端口', 'port', 'listen', '8103', '3000'])) {
    return commandGenerationMocks[0]
  }

  if (includesAny(input, ['日志', 'log', 'error', 'warn'])) {
    return commandGenerationMocks[1]
  }

  return commandGenerationMocks[0]
}

const chooseEnvironmentMock = (input: string) => {
  if (includesAny(input, ['grep', 'wc', 'awk', 'sed', 'find /'])) {
    return environmentJudgementMocks[0]
  }

  return environmentJudgementMocks[0]
}

const chooseErrorMock = (input: string) => {
  if (includesAny(input, ['executionpolicy', 'pssecurityexception', 'npm.ps1'])) {
    return errorAnalysisMocks[0]
  }

  if (includesAny(input, ['eaddrinuse', 'address already in use', '端口'])) {
    return errorAnalysisMocks[1]
  }

  return errorAnalysisMocks[0]
}

const chooseTemplate = (templateId?: string): WorkflowTemplate =>
  builtInWorkflows.find((template) => template.id === templateId) ?? defaultTemplate

const sortVariants = (variants: CommandVariant[], preferredShell: AssistantRequest['preferredShell']) =>
  [...variants].sort((left, right) => {
    if (left.shell === preferredShell) {
      return -1
    }

    if (right.shell === preferredShell) {
      return 1
    }

    return 0
  })

const buildTemplateResult = (templateId?: string) => {
  const template = chooseTemplate(templateId)

  return (
    workflowTemplateMocks.find((item) => item.template.id === template.id) ??
    workflowTemplateMocks[0]
  )
}

const buildResultFromTask = (
  request: AssistantRequest,
): AssistantResult => {
  const { taskType, input, templateId, preferredShell, environment } = request
  const baseResult =
    taskType === 'generate-command'
      ? chooseCommandMock(input)
      : taskType === 'analyze-error'
        ? chooseErrorMock(input)
        : taskType === 'judge-environment'
          ? chooseEnvironmentMock(input)
          : buildTemplateResult(templateId)

  const result = structuredClone(baseResult)

  if ('variants' in result) {
    result.variants = sortVariants(result.variants, preferredShell)
  }

  if ('quickChecks' in result) {
    result.quickChecks = sortVariants(result.quickChecks, preferredShell)
  }

  if ('starterCommands' in result) {
    result.starterCommands = sortVariants(result.starterCommands, preferredShell)
  }

  if ('investigationSteps' in result) {
    result.investigationSteps = result.investigationSteps.map((step) => ({
      ...step,
      commands: step.commands
        ? sortVariants(step.commands, preferredShell)
        : undefined,
    }))
  }

  if ('template' in result) {
    result.template = {
      ...result.template,
      steps: result.template.steps.map((step) => ({
        ...step,
        commands: step.commands
          ? sortVariants(step.commands, preferredShell)
          : undefined,
      })),
    }
  }

  if (environment !== result.recommendedEnvironment) {
    result.nextSteps = [
      `你当前选择的是 ${environment}，但 mock 结果判断更适合 ${result.recommendedEnvironment}。`,
      ...result.nextSteps,
    ]
  }

  return result
}

export async function resolveWorkflowAssistant(
  request: AssistantRequest,
): Promise<AssistantResult> {
  const delay = Number(import.meta.env.VITE_MOCK_DELAY_MS ?? 450)

  await new Promise((resolve) => window.setTimeout(resolve, delay))

  return buildResultFromTask({
    ...request,
    input: request.input.toLowerCase(),
  })
}
