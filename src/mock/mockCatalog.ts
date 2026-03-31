import type {
  CrossShellCommandResult,
  EnvironmentJudgementResult,
  ErrorAnalysisResult,
  RiskHint,
  WorkflowTemplateResult,
} from '../types'
import { builtInWorkflows } from '../data/builtInWorkflows'

const portRisk: RiskHint = {
  id: 'risk-port-process',
  level: 'medium',
  title: '结束占用进程前先确认用途',
  detail: '很多端口占用来自旧的开发服务或本机代理，直接结束可能影响其他任务。',
  saferAlternative: '先定位 PID 和进程名，再决定是否切换端口。',
}

export const commandGenerationMocks: CrossShellCommandResult[] = [
  {
    kind: 'command-generation',
    taskType: 'generate-command',
    title: '查看端口占用的跨 shell 命令',
    summary: '这个任务更适合先在 Windows 本机执行，因为端口监听发生在当前操作系统上。',
    recommendedEnvironment: 'windows-local',
    variants: [
      {
        shell: 'powershell',
        label: 'PowerShell',
        command:
          'Get-NetTCPConnection -LocalPort 8103 | Select-Object LocalAddress, LocalPort, State, OwningProcess',
        available: true,
      },
      {
        shell: 'cmd',
        label: 'cmd',
        command: 'netstat -ano | findstr :8103',
        available: true,
      },
      {
        shell: 'wsl',
        label: 'WSL / Bash',
        command: 'lsof -i :8103',
        available: true,
        notes: '只有服务实际跑在 WSL 环境时才优先用这条。',
      },
    ],
    differenceNotes: [
      'PowerShell 能直接拿到 OwningProcess，后续接 Stop-Process 更顺手。',
      'cmd 适合临时查看，但后续结构化处理不如 PowerShell。',
      'WSL 只适用于端口归属在 Linux 子系统内的情况。',
    ],
    risks: [portRisk],
    nextSteps: [
      '如果确认是残留进程，再查 PID 对应的进程名。',
      '如果不能结束旧进程，改用新的服务端口。',
      '把端口配置写入环境变量，避免团队默认值冲突。',
    ],
  },
  {
    kind: 'command-generation',
    taskType: 'generate-command',
    title: '统计日志中 ERROR 的行数',
    summary: '如果日志文件在 WSL 或 Linux 侧，Bash 管道更自然；如果是 Windows 本机日志，PowerShell 更稳。',
    recommendedEnvironment: 'wsl',
    variants: [
      {
        shell: 'powershell',
        label: 'PowerShell',
        command:
          '(Select-String -Path .\\application.log -Pattern "ERROR").Count',
        available: true,
      },
      {
        shell: 'cmd',
        label: 'cmd',
        command: 'find /c "ERROR" application.log',
        available: true,
        notes: '只能做基础统计，扩展性较弱。',
      },
      {
        shell: 'wsl',
        label: 'WSL / Bash',
        command: 'grep -c "ERROR" application.log',
        available: true,
      },
    ],
    differenceNotes: [
      'PowerShell 和 cmd 适合直接处理 Windows 路径。',
      'Bash 在管道和文本处理上更简洁，适合 Linux 风格日志排查。',
    ],
    risks: [],
    nextSteps: [
      '如果还要筛选 WARN、500、timeout，优先切到 WSL 或 Bash。',
      '如果日志在远端机器，改为 SSH 后在服务器上执行。',
    ],
  },
]

export const environmentJudgementMocks: EnvironmentJudgementResult[] = [
  {
    kind: 'environment-judgement',
    taskType: 'judge-environment',
    title: '这条 grep 管道更适合在 WSL / Bash 执行',
    summary: '命令依赖 grep 和 wc 的类 Unix 语义，在 PowerShell 中应改写而不是直接照搬。',
    recommendedEnvironment: 'wsl',
    confidence: 'high',
    reasoning: [
      '管道链条依赖 grep 与 wc，这是 Linux/Unix 常见组合。',
      'PowerShell 虽然能实现等价能力，但原命令并不原生适配。',
      '如果日志实际位于远端服务器，更应 SSH 到远端 Linux 上执行。',
    ],
    variants: [
      {
        shell: 'wsl',
        label: '推荐写法',
        command: 'grep "ERROR" application.log | wc -l',
        available: true,
      },
      {
        shell: 'powershell',
        label: 'PowerShell 改写',
        command: '(Select-String -Path .\\application.log -Pattern "ERROR").Count',
        available: true,
      },
      {
        shell: 'cmd',
        label: 'cmd',
        command: 'find /c "ERROR" application.log',
        available: true,
        notes: '能力较弱，不建议作为默认方案。',
      },
    ],
    risks: [],
    nextSteps: [
      '先确认日志文件在哪个文件系统里。',
      '如果在 Windows 路径下，优先改写为 PowerShell。',
      '如果在服务器上，直接 SSH 后执行远端 Linux 命令。',
    ],
  },
]

export const errorAnalysisMocks: ErrorAnalysisResult[] = [
  {
    kind: 'error-analysis',
    taskType: 'analyze-error',
    title: 'PowerShell 执行策略阻止了脚本运行',
    summary: '这是典型的 Windows 本机 PowerShell 安全策略问题，优先在本机排查，不需要切到 WSL。',
    recommendedEnvironment: 'windows-local',
    probableCauses: [
      '当前 PowerShell 执行策略过严，例如 Restricted。',
      '下载脚本带有 Mark-of-the-Web 标记。',
      '命令实际调用到了 npm.ps1 或其他脚本入口，而不是 .cmd。',
    ],
    investigationSteps: [
      {
        id: 'policy-check',
        title: '查看当前执行策略',
        detail: '先确认是 CurrentUser 还是 LocalMachine 层级限制。',
        environment: 'windows-local',
        commands: [
          {
            shell: 'powershell',
            label: 'PowerShell',
            command: 'Get-ExecutionPolicy -List',
            available: true,
          },
        ],
      },
      {
        id: 'cmd-fallback',
        title: '优先使用 .cmd 入口绕开脚本策略',
        detail: '像 npm、pnpm 这类工具在 Windows 下常有 .cmd 入口，适合先验证命令本身是否可运行。',
        environment: 'windows-local',
        commands: [
          {
            shell: 'cmd',
            label: 'cmd',
            command: 'npm.cmd -v',
            available: true,
          },
        ],
      },
    ],
    quickChecks: [
      {
        shell: 'powershell',
        label: 'PowerShell',
        command: 'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned',
        available: true,
        notes: '修改前先确认公司安全策略。',
      },
    ],
    risks: [
      {
        id: 'risk-policy',
        level: 'medium',
        title: '修改执行策略会影响本机后续脚本行为',
        detail: '先确认变更范围，只改 CurrentUser，避免直接放宽到系统级。',
      },
    ],
    nextSteps: [
      '先用 .cmd 入口确认工具本身没问题。',
      '如果必须改执行策略，优先用 CurrentUser 范围。',
      '记录团队统一建议，减少新人重复踩坑。',
    ],
  },
  {
    kind: 'error-analysis',
    taskType: 'analyze-error',
    title: '端口已被占用，先确认是本机还是 WSL 里的进程',
    summary: '这类报错往往不是代码本身出错，而是旧进程没有退出干净。',
    recommendedEnvironment: 'windows-local',
    probableCauses: [
      '上次开发服务退出不完整。',
      '另一个应用使用了同一默认端口。',
      '服务同时在 Windows 和 WSL 中各启动了一次。',
    ],
    investigationSteps: [
      {
        id: 'check-windows-port',
        title: '先在 Windows 本机检查端口',
        detail: '如果结果为空，再考虑去 WSL 检查。',
        environment: 'windows-local',
        commands: [
          {
            shell: 'powershell',
            label: 'PowerShell',
            command:
              'Get-NetTCPConnection -LocalPort 3000 | Select-Object LocalPort, State, OwningProcess',
            available: true,
          },
        ],
      },
      {
        id: 'check-wsl-port',
        title: '如果服务可能在 WSL 内运行，再到 WSL 检查',
        detail: '避免一上来就在错误环境里排查。',
        environment: 'wsl',
        commands: [
          {
            shell: 'wsl',
            label: 'WSL / Bash',
            command: 'lsof -i :3000',
            available: true,
          },
        ],
      },
    ],
    quickChecks: [
      {
        shell: 'powershell',
        label: '结束进程',
        command: 'Stop-Process -Id <PID>',
        available: true,
      },
    ],
    risks: [portRisk],
    nextSteps: [
      '先判断进程归属环境，再执行终止操作。',
      '避免同时启动 Windows 和 WSL 两套开发服务。',
      '必要时把端口改成可配置项。',
    ],
  },
]

export const workflowTemplateMocks: WorkflowTemplateResult[] = builtInWorkflows.map(
  (template) => ({
    kind: 'workflow-template',
    taskType: 'use-template',
    title: template.name,
    summary: template.description,
    recommendedEnvironment: template.recommendedEnvironment,
    template,
    starterCommands: template.steps.flatMap((step) => step.commands ?? []).slice(0, 3),
    risks: template.steps.flatMap((step) => (step.risk ? [step.risk] : [])),
    nextSteps: [
      '先按模板从上到下执行，不要同时跳多个环境。',
      '把确认有效的步骤沉淀为个人模板或团队 SOP。',
    ],
  }),
)
