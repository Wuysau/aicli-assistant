import {
  executionPolicyRisk,
  forceKillRisk,
  gitHookBypassRisk,
  stopProcessRisk,
} from './riskPresets'
import type { CommandVariant, EnvironmentType, RiskHint, ShellType, WorkflowCatalogEntry } from '../types'

const command = (
  shell: ShellType,
  label: string,
  value: string,
  notes?: string,
): CommandVariant => ({
  shell,
  label,
  command: value,
  available: true,
  notes,
})

const step = (
  id: string,
  title: string,
  detail: string,
  environment: EnvironmentType,
  commands?: CommandVariant[],
  risk?: RiskHint,
) => ({
  id,
  title,
  detail,
  environment,
  commands,
  risk,
})

export const workflowCatalog: WorkflowCatalogEntry[] = [
  {
    template: {
      id: 'port-occupancy',
      title: '查端口占用',
      aliases: ['查端口', '看端口占用', '谁在监听端口'],
      source: 'local-structured-template-library',
      category: '开发排障',
      summary:
        '先确认端口到底在 Windows 本机、WSL 还是容器环境里监听，再决定要不要继续查 PID 和进程名。',
      recommendedEnvironment: 'windows-local',
      supportedShells: ['powershell', 'cmd', 'wsl'],
      mainCommand: command(
        'powershell',
        'PowerShell',
        'Get-NetTCPConnection -LocalPort 8103 | Select-Object LocalAddress, LocalPort, State, OwningProcess',
      ),
      alternateCommands: [
        command('cmd', 'cmd', 'netstat -ano | findstr :8103'),
        command('wsl', 'WSL', 'lsof -i :8103', '仅当目标服务明确跑在 Linux / WSL 侧时再使用。'),
      ],
      explanation: [
        '这是典型的本机入口排查问题，优先在 Windows 本机确认监听状态和 PID。',
        '如果服务明确跑在 WSL 或容器里，再切换到 Linux 侧继续定位。',
      ],
      risks: [],
      tags: ['端口', '监听', 'PID', 'netstat', 'Node', 'Java'],
      samplePrompt: '查看 8103 端口被谁占用',
      promptExamples: ['谁在监听 3000', '看下 8080 端口是谁占的', '查端口 5173 被哪个进程占用'],
      steps: [
        step(
          'port-check-windows',
          '先在 Windows 本机确认监听状态',
          '本机开发环境优先用 PowerShell 或 cmd 看监听和 PID，避免一开始就切到 WSL。',
          'windows-local',
          [
            command(
              'powershell',
              'PowerShell',
              'Get-NetTCPConnection -LocalPort 8103 | Select-Object LocalAddress, LocalPort, State, OwningProcess',
            ),
            command('cmd', 'cmd', 'netstat -ano | findstr :8103'),
          ],
        ),
        step(
          'port-check-process',
          '结合 PID 再看进程名',
          '先把监听端口和具体进程关联起来，再决定是否结束进程或改端口。',
          'windows-local',
          [
            command(
              'powershell',
              'PowerShell',
              'Get-Process -Id 1234 | Select-Object Id, ProcessName, Path',
            ),
          ],
        ),
        step(
          'port-check-linux',
          '服务在 Linux 侧时再转到 WSL',
          '只有确认服务实际跑在 WSL 或容器内，才值得用 Linux 侧命令继续追查。',
          'wsl',
          [command('wsl', 'WSL', 'lsof -i :8103')],
        ),
      ],
    },
    intent: {
      keywords: ['端口', '监听', 'port', 'listen', 'netstat', 'lsof', '占用'],
      aliases: ['查端口', '谁占端口', '谁在监听'],
      naturalPhrases: [
        '8080 被谁占用',
        '3000 端口是谁占的',
        '谁在监听 8103',
        '查一下端口冲突',
        '8103 被谁占了',
      ],
      commandHints: ['Get-NetTCPConnection', 'netstat -ano', 'lsof -i'],
      taskTypeBoosts: ['generate-command', 'analyze-error', 'judge-environment', 'use-template'],
    },
    guide: {
      commandSummary:
        '这类问题先在 Windows 本机确认监听 PID，再决定是否需要转到 WSL 或容器环境继续排查。',
      environmentSummary:
        '端口占用默认属于本机入口排查问题，建议优先在 Windows 本机执行，再按服务实际归属切换环境。',
      errorSummary:
        '端口冲突大多不是代码本身出错，而是旧实例残留、多个服务共用默认端口，或 Windows / WSL 同时起了服务。',
      reasoning: [
        'PowerShell 可以直接拿到 OwningProcess，适合本机入口排查。',
        'cmd 适合快速兜底确认，WSL 只适合 Linux 侧服务。',
      ],
      supportingSignals: ['输入中出现端口号、监听、listen、占用、netstat、lsof 等关键词。'],
      conflictingSignals: ['如果服务明确部署在远端 Linux，先在本机查端口只能作为入口，不是最终结论。'],
      probableCauses: ['旧服务未退出', '多个项目共用同一默认端口', 'Windows 与 WSL 同时起了服务'],
      differenceNotes: [
        'PowerShell 更适合本机查 PID。',
        'WSL 写法更适合 Linux 进程，而不是 Windows 进程。',
      ],
      nextSteps: ['先确认 PID 和进程名，再决定结束进程还是改端口。', '必要时把端口配置写进环境变量，减少团队冲突。'],
      handoffSteps: ['如果确认服务跑在 WSL 或容器里，再切到 Linux 侧继续查 `lsof` 或 `ss`。'],
      riskLevel: 'medium',
      recommendedShells: ['powershell', 'cmd'],
    },
  },
  {
    template: {
      id: 'kill-process',
      title: '杀进程',
      aliases: ['结束进程', '结束 PID', '停掉残留进程'],
      source: 'local-structured-template-library',
      category: '开发排障',
      summary:
        '先识别 PID 和进程归属，再结束残留实例，不把“强杀进程”当默认第一步。',
      recommendedEnvironment: 'windows-local',
      supportedShells: ['powershell', 'cmd', 'wsl'],
      mainCommand: command('powershell', 'PowerShell', 'Stop-Process -Id 1234'),
      alternateCommands: [
        command('cmd', 'cmd', 'taskkill /PID 1234 /F'),
        command('wsl', 'WSL', 'kill -9 1234', '仅适用于 Linux / WSL 侧进程。'),
      ],
      explanation: [
        '真正该杀的是“确认归属后的残留进程”，而不是所有占端口的进程。',
        '如果只是临时冲突，改端口通常比强杀更稳妥。',
      ],
      risks: [stopProcessRisk, forceKillRisk],
      tags: ['进程', 'PID', 'taskkill', 'Stop-Process', 'kill'],
      samplePrompt: '结束占用 8103 端口的进程',
      promptExamples: ['结束 PID 1234', '杀掉残留的 Node 进程', '关闭占端口的 Java 进程'],
      steps: [
        step(
          'kill-identify',
          '先确认 PID 和路径',
          '先看清楚目标到底是旧服务、IDE 辅助进程还是代理程序。',
          'windows-local',
          [
            command('powershell', 'PowerShell', 'Get-Process -Id 1234 | Select-Object Id, ProcessName, Path'),
            command('cmd', 'cmd', 'tasklist | findstr 1234'),
          ],
          forceKillRisk,
        ),
        step(
          'kill-stop',
          '确认无误后再结束',
          '确认是目标进程后再结束；如果只是临时冲突，也可以优先换端口。',
          'windows-local',
          [
            command('powershell', 'PowerShell', 'Stop-Process -Id 1234'),
            command('cmd', 'cmd', 'taskkill /PID 1234 /F'),
            command('wsl', 'WSL', 'kill -9 1234', '仅限 Linux / WSL 进程。'),
          ],
          stopProcessRisk,
        ),
      ],
    },
    intent: {
      keywords: ['杀进程', '结束进程', 'kill', 'taskkill', 'stop-process', 'pid', '结束', '停掉', '关闭', '进程'],
      aliases: ['结束 pid', '停掉进程', '关掉残留进程', '结束占用端口的进程'],
      naturalPhrases: ['杀掉 1234', '把占端口的进程停掉', '结束这个 node 进程', '结束占用 8103 端口的进程'],
      commandHints: ['taskkill', 'Stop-Process', 'kill -9'],
      taskTypeBoosts: ['generate-command', 'analyze-error', 'use-template'],
    },
    guide: {
      commandSummary: '先识别进程归属，再结束目标进程；不要默认上来就强杀。',
      environmentSummary:
        '如果 PID 属于 Windows 进程，就在 PowerShell 或 cmd 中结束；只有 PID 属于 Linux / WSL 时才切到 WSL。',
      errorSummary:
        '结束进程后问题仍存在时，通常根因不是单个残留实例，而是自动拉起、端口配置冲突或环境判断错误。',
      reasoning: ['Windows 和 WSL 的 PID 空间不同。', '误杀进程的代价通常高于临时改端口。'],
      supportingSignals: ['输入里出现 PID、taskkill、Stop-Process、kill 等进程操作词。'],
      conflictingSignals: ['如果目标其实是远端服务或容器，直接在本机杀进程没有意义。'],
      probableCauses: ['误杀了错误环境中的 PID', '目标进程被守护脚本自动拉起', '真正问题其实是端口配置冲突'],
      differenceNotes: ['PowerShell 更适合先看 ProcessName 和 Path。', 'WSL 的 `kill` 只适用于 Linux 进程。'],
      nextSteps: ['先确认 PID 归属和进程路径。', '保留当前输出，避免误操作后无法回溯。'],
      handoffSteps: ['如果 PID 不属于 Windows 进程，再切到 WSL 或远端执行 `kill`。'],
      riskLevel: 'high',
      recommendedShells: ['powershell', 'cmd'],
    },
  },
  {
    template: {
      id: 'count-log-signals',
      title: '统计日志 ERROR / WARN / 500',
      aliases: ['统计日志', '查日志关键字', 'grep 日志'],
      source: 'local-structured-template-library',
      category: '日志排查',
      summary:
        '先确认日志文件在哪个文件系统，再决定用 PowerShell 还是 grep 管道。',
      recommendedEnvironment: 'wsl',
      supportedShells: ['powershell', 'wsl', 'bash'],
      mainCommand: command(
        'wsl',
        'WSL',
        'printf "ERROR: "; grep -c "ERROR" application.log; printf "WARN: "; grep -c "WARN" application.log; printf "500: "; grep -c "500" application.log',
      ),
      alternateCommands: [
        command(
          'bash',
          'Bash',
          'printf "ERROR: "; grep -c "ERROR" application.log; printf "WARN: "; grep -c "WARN" application.log; printf "500: "; grep -c "500" application.log',
        ),
        command(
          'powershell',
          'PowerShell',
          '@("ERROR","WARN","500") | ForEach-Object { "{0}: {1}" -f $_, (Select-String -Path .\\application.log -Pattern $_).Count }',
          '当日志文件位于 Windows 路径时更适合使用。',
        ),
      ],
      explanation: [
        '关键不是命令长短，而是日志文件到底在 Windows 路径、WSL 路径还是远端主机上。',
        'PowerShell 更适合 Windows 路径，grep / wc 更适合 Linux 文本流。',
      ],
      risks: [],
      tags: ['日志', 'ERROR', 'WARN', '500', 'grep', 'Select-String'],
      samplePrompt: '统计 application.log 里的 ERROR、WARN 和 500',
      promptExamples: ['统计日志里的 timeout 次数', '看下 500 和 WARN 的数量', 'grep error 日志计数'],
      steps: [
        step(
          'log-locate',
          '先判断日志位置',
          'Windows 路径优先 PowerShell，Linux 路径或远端日志再用 grep 管道。',
          'windows-local',
        ),
        step(
          'log-count-powershell',
          'Windows 日志优先 PowerShell',
          'PowerShell 更适合处理 Windows 路径和对象式输出。',
          'windows-local',
          [
            command(
              'powershell',
              'PowerShell',
              '@("ERROR","WARN","500") | ForEach-Object { "{0}: {1}" -f $_, (Select-String -Path .\\application.log -Pattern $_).Count }',
            ),
          ],
        ),
        step(
          'log-count-grep',
          'Linux / WSL 日志用 grep 管道',
          '当日志位于 WSL 或远端 Linux 时，grep 写法更短，也更贴近环境。',
          'wsl',
          [
            command(
              'wsl',
              'WSL',
              'printf "ERROR: "; grep -c "ERROR" application.log; printf "WARN: "; grep -c "WARN" application.log; printf "500: "; grep -c "500" application.log',
            ),
          ],
        ),
      ],
    },
    intent: {
      keywords: ['日志', 'error', 'warn', '500', 'grep', 'log', 'select-string'],
      aliases: ['统计日志', '查日志关键字', 'grep 日志'],
      naturalPhrases: ['统计日志里的 error', '看下 warn 有多少条', '数一下 500 次数'],
      commandHints: ['grep -c', 'Select-String', 'wc -l'],
      taskTypeBoosts: ['generate-command', 'judge-environment', 'use-template', 'analyze-error'],
    },
    guide: {
      commandSummary:
        '日志统计是典型的跨 shell 场景，先判断文件在哪，再选择 PowerShell 或 grep。',
      environmentSummary:
        '如果日志在 Windows 路径下，优先用 PowerShell；如果日志在 WSL 或远端 Linux，用 grep / wc 更自然。',
      errorSummary:
        '统计结果异常时，常见原因不是命令不能用，而是路径、编码、大小写或轮转文件判断错了。',
      reasoning: [
        'grep / wc 是类 Unix 场景的原生工具。',
        'PowerShell 更适合处理 Windows 路径和 Select-String。',
      ],
      supportingSignals: ['输入中出现 grep、日志统计、ERROR、WARN、500 等文本搜索词。'],
      conflictingSignals: ['如果日志只存在于 Windows 路径，强行搬到 Bash 管道里并不划算。'],
      probableCauses: ['日志不在当前环境', '日志已经轮转，查错了文件', '大小写或匹配模式不一致'],
      differenceNotes: ['PowerShell 路径处理更稳。', 'WSL / Bash 管道更短，也更适合远端文本日志。'],
      nextSteps: ['先确认日志路径属于 Windows、WSL 还是远端主机。', '必要时先用单一关键词做小范围验证。'],
      handoffSteps: ['如果日志只在远端主机上，再切到 SSH 会话继续统计。'],
      riskLevel: 'low',
      recommendedShells: ['wsl', 'bash', 'powershell'],
    },
  },
  {
    template: {
      id: 'maven-package-skip-tests',
      title: 'Maven 跳过测试打包',
      aliases: ['maven 打包', '跳过测试打包', 'clean package'],
      source: 'local-structured-template-library',
      category: '构建流程',
      summary: '给出稳定的 Maven 跳测打包写法，并明确它只适合临时验证构建链路。',
      recommendedEnvironment: 'windows-local',
      supportedShells: ['powershell', 'cmd'],
      mainCommand: command('powershell', 'PowerShell', 'mvn clean package -DskipTests'),
      alternateCommands: [command('cmd', 'cmd', 'mvn clean package -DskipTests')],
      explanation: [
        '跳过测试适合做临时构建验证，不适合替代正常测试链路。',
        '真正的差异通常不在 shell，而在 JDK、Maven 和私服配置。',
      ],
      risks: [],
      tags: ['Maven', 'mvn', '打包', 'Java', 'skipTests'],
      samplePrompt: 'Maven 跳过测试打包',
      promptExamples: ['mvn package 跳过测试', '只验证构建不跑测试', 'clean package skipTests'],
      steps: [
        step(
          'maven-command',
          '使用标准跳测打包命令',
          '先覆盖最常见的本机构建写法，不扩展 profile 和多模块组合。',
          'windows-local',
          [
            command('powershell', 'PowerShell', 'mvn clean package -DskipTests'),
            command('cmd', 'cmd', 'mvn clean package -DskipTests'),
          ],
        ),
        step(
          'maven-verify',
          '补一轮最小验证',
          '先确认 Maven 和 JDK 自身可用，再判断是不是依赖或私服问题。',
          'windows-local',
          [command('powershell', 'PowerShell', 'mvn -v')],
        ),
      ],
    },
    intent: {
      keywords: ['maven', 'mvn', 'skiptests', 'package', '打包', '跳过测试'],
      aliases: ['maven 打包', '跳过测试打包', 'clean package'],
      naturalPhrases: ['mvn 打包别跑测试', '只想先 package', '跳过单测构建', '先把包打出来别跑测试'],
      commandHints: ['mvn clean package -DskipTests'],
      taskTypeBoosts: ['generate-command', 'use-template'],
    },
    guide: {
      commandSummary:
        '这是标准本机构建动作，重点是给出稳定命令并明确“跳过测试”的适用边界。',
      environmentSummary:
        'Maven 构建默认优先在 Windows 本机执行，除非项目明确要求在 WSL 内使用独立的 JDK 和 Maven。',
      errorSummary:
        '如果跳过测试仍失败，问题大多在 JDK、Maven、私服访问或 package 阶段额外插件校验。',
      reasoning: ['PowerShell 和 cmd 下的 Maven 基础写法几乎一致。', '环境差异主要来自 JDK、settings.xml 和代理配置。'],
      supportingSignals: ['输入里出现 maven、mvn、package、skipTests 等构建词。'],
      conflictingSignals: ['如果团队链路只在 Linux runner 上稳定，本机跳测只能做临时验证。'],
      probableCauses: ['JDK 或 Maven 未配置好', '私服凭据或网络代理异常', 'package 阶段还有额外校验'],
      differenceNotes: ['PowerShell 和 cmd 基础写法一致。', '切到 WSL 通常意味着又换了一套 JDK / Maven 环境。'],
      nextSteps: ['先运行 `mvn -v` 确认工具链。', '跳过测试仅用于缩短验证闭环，不要替代正常测试。'],
      handoffSteps: ['如果团队依赖 Linux 构建环境，再转到 WSL 或 CI runner 做最终验证。'],
      riskLevel: 'low',
      recommendedShells: ['powershell', 'cmd'],
    },
  },
  {
    template: {
      id: 'git-user-email',
      title: '查看 Git 用户名邮箱',
      aliases: ['查看 git 用户', '看 git 邮箱', 'git config user'],
      source: 'local-structured-template-library',
      category: 'Git 排障',
      summary: '同时看 local 和 global，先判断你当前到底在用哪一套 Git 配置。',
      recommendedEnvironment: 'windows-local',
      supportedShells: ['powershell', 'cmd', 'wsl', 'bash'],
      mainCommand: command(
        'powershell',
        'PowerShell',
        'git config user.name; git config user.email; git config --global user.name; git config --global user.email',
      ),
      alternateCommands: [
        command(
          'cmd',
          'cmd',
          'git config user.name && git config user.email && git config --global user.name && git config --global user.email',
        ),
        command(
          'wsl',
          'WSL',
          'git config user.name && git config user.email && git config --global user.name && git config --global user.email',
        ),
      ],
      explanation: [
        'local 配置和 global 配置是两套概念，提交身份常常是 local 覆盖了 global。',
        'Windows Git 与 WSL Git 各自独立，看到的用户名邮箱可能不同。',
      ],
      risks: [],
      tags: ['Git', 'user.name', 'user.email', 'config'],
      samplePrompt: '查看当前 Git 用户名和邮箱',
      promptExamples: ['当前仓库提交人是谁', '看下全局 git user/email', 'git config 用户邮箱'],
      steps: [
        step(
          'git-user-local',
          '先看当前仓库 local 配置',
          'local 配置优先级更高，最能解释当前仓库的提交身份。',
          'windows-local',
          [
            command('powershell', 'PowerShell', 'git config user.name; git config user.email'),
            command('wsl', 'WSL', 'git config user.name && git config user.email'),
          ],
        ),
        step(
          'git-user-global',
          '再看 global 默认配置',
          'global 配置用于判断当前机器的默认提交身份。',
          'windows-local',
          [command('powershell', 'PowerShell', 'git config --global user.name; git config --global user.email')],
        ),
      ],
    },
    intent: {
      keywords: ['git user', 'user.name', 'user.email', 'git config', '用户名', '邮箱'],
      aliases: ['看 git 用户', '查 git 邮箱', 'git config user'],
      naturalPhrases: ['当前仓库提交人是谁', '我的 git 邮箱是什么', '看下 git 用户名', '当前仓库作者是谁'],
      commandHints: ['git config user.name', 'git config user.email'],
      taskTypeBoosts: ['generate-command', 'use-template', 'judge-environment'],
    },
    guide: {
      commandSummary: '先看 local，再看 global，同时确认你用的是 Windows Git 还是 WSL Git。',
      environmentSummary:
        '如果仓库在 Windows 本机上操作，优先在 Windows Git 中查看；仓库在 WSL 内时，要切到 WSL 看同名配置。',
      errorSummary:
        '提交身份不对时，通常不是 Git 坏了，而是 local 覆盖 global、当前 shell 使用了另一套 Git，或仓库目录不在预期环境。',
      reasoning: ['local 配置优先级高于 global。', 'Windows Git 与 WSL Git 的配置彼此独立。'],
      supportingSignals: ['输入中出现 git config、用户名、邮箱、commit author 等词。'],
      conflictingSignals: ['如果问题已经明确发生在 CI 或远端服务器，单看本地配置并不能解释全部现象。'],
      probableCauses: ['local 配置覆盖了 global', 'Windows Git 与 WSL Git 配置不同', '仓库实际不在当前 shell 访问的文件系统里'],
      differenceNotes: ['PowerShell、cmd 与 WSL 的写法差异不大。', '真正差异在于使用的是哪套 Git。'],
      nextSteps: ['先看 local，再看 global。', '确认当前 shell 使用的是 Windows Git 还是 WSL Git。'],
      handoffSteps: ['如果仓库在 WSL 内操作，再切到 WSL 重查同样的配置。'],
      riskLevel: 'low',
      recommendedShells: ['powershell', 'cmd', 'wsl'],
    },
  },
  {
    template: {
      id: 'git-push-hook-rejected',
      title: 'Git push hook 拒绝排查',
      aliases: ['hook 失败', 'push 被拒绝', 'pre-receive rejected'],
      source: 'local-structured-template-library',
      category: 'Git 排障',
      summary: '把 push 被拒绝拆成提交规范、lint/test、权限和远端保护四类原因。',
      recommendedEnvironment: 'windows-local',
      supportedShells: ['powershell', 'cmd', 'wsl', 'bash'],
      mainCommand: command('powershell', 'PowerShell', 'git status; git log --oneline -3'),
      alternateCommands: [
        command('wsl', 'WSL', 'git status && git log --oneline -3'),
        command('cmd', 'cmd', 'git status && git log --oneline -3'),
      ],
      explanation: [
        '先保留完整报错，再区分是本地 hook、CI 检查还是远端分支保护。',
        '不要在未定位前直接使用 `--no-verify`、`push --force` 或 reset。',
      ],
      risks: [gitHookBypassRisk],
      tags: ['Git', 'hook', 'push', 'pre-push', 'pre-receive'],
      samplePrompt: 'Git push 被 hook 拒绝了',
      promptExamples: ['pre-push hook failed', 'remote rejected pre-receive', 'push 被拒绝怎么排查'],
      steps: [
        step(
          'hook-keep-output',
          '先保留完整报错',
          '不要急着 reset、rebase 或强推，先区分是本地 hook 还是远端规则。',
          'windows-local',
          undefined,
          gitHookBypassRisk,
        ),
        step(
          'hook-check-basic',
          '检查提交状态和最近提交',
          '先确定是提交内容、脚本校验，还是权限或分支策略问题。',
          'windows-local',
          [
            command('powershell', 'PowerShell', 'git status; git log --oneline -3'),
            command('wsl', 'WSL', 'git status && git log --oneline -3'),
          ],
        ),
      ],
    },
    intent: {
      keywords: ['hook', 'pre-push', 'pre-commit', 'commit-msg', 'remote rejected', 'push rejected'],
      aliases: ['push 被拒绝', 'hook 失败', 'pre receive'],
      naturalPhrases: ['git push 被拒绝了', 'pre-push hook failed', '远端不让我推'],
      commandHints: ['git status', 'git log --oneline', '--no-verify'],
      taskTypeBoosts: ['analyze-error', 'generate-command', 'use-template'],
    },
    guide: {
      commandSummary:
        '先读清 hook 拒绝原因，再判断是提交规范、lint / test、权限还是远端保护策略。',
      environmentSummary:
        '大多数 hook 排查先在本机完成，因为脚本通常先在本地运行；只有远端 pre-receive 才需要继续看服务端侧规则。',
      errorSummary:
        'hook 拒绝通常不是 Git 坏了，而是团队规则、提交格式或校验脚本没有通过。',
      reasoning: ['本地 hook 先看原始输出，不要先 reset 或强推。', 'pre-commit、commit-msg、pre-push 与 pre-receive 的入口不同。'],
      supportingSignals: ['输入中出现 hook、pre-push、pre-commit、remote rejected、commit-msg 等词。'],
      conflictingSignals: ['如果问题已经明确发生在远端仓库策略，本机只能做入口验证。'],
      probableCauses: ['提交信息不符合规范', 'lint、test 或 type-check 未通过', '远端分支保护或权限策略拦截'],
      differenceNotes: ['Windows 与 WSL 的 hook 解释器、路径和换行处理可能不同。'],
      nextSteps: ['先保留完整 hook 输出。', '确认是本地 hook 失败还是远端 pre-receive 拒绝。', '不要在未定位前直接使用 `--no-verify` 或强推。'],
      handoffSteps: ['如果是远端策略拦截，再去看 Git 平台分支保护或 CI 状态。'],
      riskLevel: 'medium',
      recommendedShells: ['powershell', 'wsl', 'cmd'],
    },
  },
  {
    template: {
      id: 'java-port-conflict',
      title: 'Java 端口冲突排查',
      aliases: ['java 端口冲突', 'spring boot 端口占用', 'address already in use'],
      source: 'local-structured-template-library',
      category: 'Java 排障',
      summary: '先确认是旧 Java 进程残留、端口配置冲突，还是服务实例重复启动。',
      recommendedEnvironment: 'windows-local',
      supportedShells: ['powershell', 'cmd', 'wsl'],
      mainCommand: command(
        'powershell',
        'PowerShell',
        'Get-NetTCPConnection -LocalPort 8080 | Select-Object LocalPort, State, OwningProcess',
      ),
      alternateCommands: [
        command('cmd', 'cmd', 'netstat -ano | findstr :8080'),
        command('powershell', 'PowerShell', 'Get-Process java | Select-Object Id, ProcessName, Path'),
      ],
      explanation: [
        'Java 端口冲突常见于旧实例残留或多个 profile 共用相同端口。',
        '比起怀疑业务代码，先确认端口归属和旧 Java 进程更有效。',
      ],
      risks: [stopProcessRisk],
      tags: ['Java', 'Spring Boot', '8080', 'Address already in use'],
      samplePrompt: 'Java 启动时报端口冲突',
      promptExamples: ['Address already in use 8080', 'Spring Boot 端口已占用', 'java 服务端口冲突'],
      steps: [
        step(
          'java-port-check',
          '先看端口和 PID',
          '先找到端口归属，再判断是不是旧 Java 实例残留。',
          'windows-local',
          [
            command('powershell', 'PowerShell', 'Get-NetTCPConnection -LocalPort 8080 | Select-Object LocalPort, State, OwningProcess'),
            command('cmd', 'cmd', 'netstat -ano | findstr :8080'),
          ],
        ),
        step(
          'java-process-check',
          '确认是否为旧 Java 进程',
          '很多冲突来自上一次启动失败后进程未退出。',
          'windows-local',
          [command('powershell', 'PowerShell', 'Get-Process java | Select-Object Id, ProcessName, Path')],
          stopProcessRisk,
        ),
      ],
    },
    intent: {
      keywords: ['java', 'spring', 'address already in use', 'bindexception', '8080', '端口冲突'],
      aliases: ['java 端口冲突', 'spring boot 端口占用', 'address already in use'],
      naturalPhrases: ['spring boot 启动时报端口占用', 'java 服务 8080 冲突', '端口被 java 占了'],
      commandHints: ['Get-NetTCPConnection', 'Get-Process java', 'netstat -ano'],
      taskTypeBoosts: ['analyze-error', 'generate-command', 'use-template'],
    },
    guide: {
      commandSummary:
        'Java 端口冲突优先看端口归属和旧 Java 进程，不要一开始就怀疑业务代码。',
      environmentSummary:
        'Spring Boot 等服务多数在本机 Windows 侧启动，默认先在 Windows 本机确认，再决定是否需要查 WSL。',
      errorSummary:
        '这类问题通常来自旧 Java 进程残留、多实例共用端口，或 profile 配置冲突。',
      reasoning: ['它与普通端口占用相似，但更常伴随旧 Java 实例残留。', 'PowerShell 更适合关联端口和 Java 进程。'],
      supportingSignals: ['输入中出现 Java、Spring Boot、Address already in use、8080 等词。'],
      conflictingSignals: ['如果服务实际跑在容器或远端 Linux，本机查询只能作为入口。'],
      probableCauses: ['旧 Java / Spring Boot 进程未退出', '应用配置固定到了已占用端口', '多个 profile 共用相同端口'],
      differenceNotes: ['重点不是 shell 语法，而是先别在错误环境里排查。'],
      nextSteps: ['先确认占用进程是不是旧 Java 实例。', '必要时优先调端口，而不是直接结束所有 java 进程。'],
      handoffSteps: ['如果应用跑在 WSL 或容器，再切到对应环境继续查端口。'],
      riskLevel: 'medium',
      recommendedShells: ['powershell', 'cmd'],
    },
  },
  {
    template: {
      id: 'powershell-execution-policy',
      title: 'PowerShell 执行策略报错',
      aliases: ['执行策略报错', 'npm.ps1 无法加载', 'PSSecurityException'],
      source: 'local-structured-template-library',
      category: 'Windows 排障',
      summary: '先看策略层级，再决定是换入口、缩小影响范围，还是做一次性绕过。',
      recommendedEnvironment: 'windows-local',
      supportedShells: ['powershell', 'cmd'],
      mainCommand: command('powershell', 'PowerShell', 'Get-ExecutionPolicy -List'),
      alternateCommands: [
        command('cmd', 'cmd', 'npm.cmd -v', '先用 `.cmd` 入口验证工具链，而不是先改策略。'),
        command(
          'powershell',
          'PowerShell',
          'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned',
          '仅在确认影响范围后再使用。',
        ),
      ],
      explanation: [
        '很多 Windows 下的工具其实有 `.cmd` 包装器，先验证工具链本身是否正常。',
        '修改执行策略会影响本机后续脚本行为，必须明确范围。',
      ],
      risks: [executionPolicyRisk],
      tags: ['PowerShell', 'ExecutionPolicy', 'npm.ps1', 'PSSecurityException'],
      samplePrompt: 'PowerShell 报执行策略错误',
      promptExamples: ['npm.ps1 无法加载', 'PSSecurityException', '执行策略拦截脚本'],
      steps: [
        step(
          'policy-list',
          '查看执行策略列表',
          '先看 CurrentUser 和 LocalMachine 的策略，不要一开始就修改。',
          'windows-local',
          [command('powershell', 'PowerShell', 'Get-ExecutionPolicy -List')],
        ),
        step(
          'policy-fallback',
          '先用 .cmd 入口验证工具链',
          '很多工具都有 `.cmd` 包装器，可以先绕开 `.ps1` 验证工具链本身。',
          'windows-local',
          [command('cmd', 'cmd', 'npm.cmd -v')],
          executionPolicyRisk,
        ),
      ],
    },
    intent: {
      keywords: ['executionpolicy', 'pssecurityexception', 'npm.ps1', '执行策略', '无法加载脚本'],
      aliases: ['执行策略报错', 'npm.ps1 无法加载', 'ps1 被禁止'],
      naturalPhrases: ['powershell 不让我执行脚本', 'npm.ps1 报错', '执行策略拦住了脚本'],
      commandHints: ['Get-ExecutionPolicy', 'Set-ExecutionPolicy', 'npm.cmd -v'],
      taskTypeBoosts: ['analyze-error', 'generate-command', 'use-template'],
    },
    guide: {
      commandSummary:
        '先看执行策略层级，再判断是换 `.cmd` 入口、缩小修改范围，还是做一次性绕过。',
      environmentSummary: '这是典型的 Windows 本机问题，不应该切到 WSL 去排查。',
      errorSummary:
        '执行策略报错通常不是工具坏了，而是 PowerShell 对脚本入口的安全限制触发了。',
      reasoning: ['很多 Node 工具在 Windows 下实际调用的是 `.ps1` 包装器。', '先换 `.cmd` 入口，往往就能验证工具链本身是否正常。'],
      supportingSignals: ['输入中出现 npm.ps1、PSSecurityException、ExecutionPolicy、无法加载脚本。'],
      conflictingSignals: ['如果问题发生在远端 Linux 的 Bash 脚本，就不属于执行策略问题。'],
      probableCauses: ['CurrentUser 或 LocalMachine 策略过严', '脚本带有下载标记，触发更严格限制', '命令入口使用了 `.ps1` 而不是 `.cmd`'],
      differenceNotes: ['问题根源在 Windows PowerShell，而不是 Bash / WSL。'],
      nextSteps: ['先用 `.cmd` 入口验证工具链可用性。', '必须修改策略时，优先调整 CurrentUser 范围。'],
      handoffSteps: ['如果 `.cmd` 也失败，再回头检查 Node、npm 或 PATH 配置。'],
      riskLevel: 'medium',
      recommendedShells: ['powershell', 'cmd'],
    },
  },
  {
    template: {
      id: 'ssh-connection-basic',
      title: 'SSH 连接失败基础排查',
      aliases: ['ssh 连不上', 'ssh 超时', 'publickey 失败'],
      source: 'local-structured-template-library',
      category: '远程运维',
      summary: '优先区分网络不通、认证失败还是远端 sshd 状态异常。',
      recommendedEnvironment: 'windows-local',
      supportedShells: ['powershell', 'cmd', 'wsl', 'bash'],
      mainCommand: command('powershell', 'PowerShell', 'Test-NetConnection 10.0.0.15 -Port 22'),
      alternateCommands: [
        command('cmd', 'cmd', 'ssh -v user@10.0.0.15'),
        command('wsl', 'WSL', 'ssh -v user@10.0.0.15'),
        command('bash', 'Bash', 'sudo systemctl status sshd', '只有已经进入远端 Linux 后才使用。'),
      ],
      explanation: [
        '入口排查先确认端口可达和认证日志，再决定要不要去远端主机看 sshd。',
        '不要把“本机连不上”和“远端 sshd 异常”混成同一层问题。',
      ],
      risks: [],
      tags: ['SSH', 'Linux', '22', 'publickey', 'timeout'],
      samplePrompt: 'SSH 连不上 10.0.0.15',
      promptExamples: ['Permission denied (publickey)', 'ssh timeout', 'ssh 22 端口不通'],
      steps: [
        step(
          'ssh-local-check',
          '先在本机做入口检查',
          '先判断网络和认证哪个先出问题，再决定是否需要远端排查。',
          'windows-local',
          [
            command('powershell', 'PowerShell', 'Test-NetConnection 10.0.0.15 -Port 22'),
            command('cmd', 'cmd', 'ssh -v user@10.0.0.15'),
            command('wsl', 'WSL', 'ssh -v user@10.0.0.15'),
          ],
        ),
        step(
          'ssh-remote-check',
          '能进入远端后再看 sshd',
          '只有已经有其他入口能进远端 Linux，才继续检查 systemd 服务状态。',
          'remote-linux',
          [command('bash', 'Bash', 'sudo systemctl status sshd')],
        ),
      ],
    },
    intent: {
      keywords: ['ssh', 'publickey', 'permission denied', 'timeout', '22'],
      aliases: ['ssh 连不上', 'ssh 超时', '公钥失败'],
      naturalPhrases: ['ssh 怎么连不上', 'publickey 被拒绝', 'ssh 一直 timeout', '22 端口是不是不通'],
      commandHints: ['Test-NetConnection', 'ssh -v', 'systemctl status sshd'],
      taskTypeBoosts: ['analyze-error', 'judge-environment', 'use-template'],
    },
    guide: {
      commandSummary:
        '先区分网络不通、认证失败还是远端 sshd 异常，再决定去本机还是远端继续排查。',
      environmentSummary:
        '入口检查先在本机做；真正的服务状态检查则要在远端 Linux 上做。',
      errorSummary:
        'SSH 失败通常混合了网络、账号、密钥和服务状态问题，必须先拆层。',
      reasoning: ['PowerShell 的 `Test-NetConnection` 很适合先做端口可达性验证。', '只有确认能打到远端，才值得继续看 `sshd` 状态。'],
      supportingSignals: ['输入中出现 ssh、publickey、permission denied、timeout、22 端口。'],
      conflictingSignals: ['如果问题已经明确发生在远端 systemd 服务层，本机只能做入口验证。'],
      probableCauses: ['网络或防火墙未放通 22 端口', '密钥、用户名或权限配置错误', '远端 sshd 未启动或被安全策略限制'],
      differenceNotes: ['本机入口判断和远端服务状态判断属于两个环境，不要放在一步里做。'],
      nextSteps: ['先确认 22 端口是否可达。', '再根据 `ssh -v` 输出决定查密钥还是查远端服务。'],
      handoffSteps: ['如果已有其他方式进入远端，再检查 `sshd` 状态和日志。'],
      riskLevel: 'low',
      recommendedShells: ['powershell', 'cmd', 'wsl'],
    },
  },
  {
    template: {
      id: 'docker-container-status',
      title: '查看 Docker 容器状态',
      aliases: ['看容器状态', 'docker ps', '容器是否在跑'],
      source: 'local-structured-template-library',
      category: '容器排查',
      summary: '先看整体状态和端口映射，再看近期日志，不盲目重建或清理容器。',
      recommendedEnvironment: 'windows-local',
      supportedShells: ['powershell', 'cmd', 'wsl', 'bash'],
      mainCommand: command('powershell', 'PowerShell', 'docker ps -a'),
      alternateCommands: [
        command('cmd', 'cmd', 'docker ps -a'),
        command('wsl', 'WSL', 'docker ps -a'),
        command('bash', 'Bash', 'docker logs --tail 100 <container_name>'),
      ],
      explanation: [
        '先看容器整体状态，再看近 100 行日志，比直接删容器或 prune 更稳妥。',
        'Docker 命令在多种 shell 里差别不大，关键是 daemon 实际跑在哪。 ',
      ],
      risks: [],
      tags: ['Docker', 'container', 'docker ps', 'docker logs'],
      samplePrompt: '查看 Docker 容器状态',
      promptExamples: ['列出当前容器', '看下容器是否还在跑', 'docker 容器日志怎么查'],
      steps: [
        step(
          'docker-ps',
          '先看容器整体状态',
          '确认容器是否启动、是否退出以及端口映射是否正确。',
          'windows-local',
          [
            command('powershell', 'PowerShell', 'docker ps -a'),
            command('wsl', 'WSL', 'docker ps -a'),
          ],
        ),
        step(
          'docker-logs',
          '再看最近日志',
          '先拿最近 100 行定位退出原因，而不是上来就删容器。',
          'windows-local',
          [
            command('powershell', 'PowerShell', 'docker logs --tail 100 <container_name>'),
            command('bash', 'Bash', 'docker logs --tail 100 <container_name>'),
          ],
        ),
      ],
    },
    intent: {
      keywords: ['docker', 'container', 'docker ps', 'docker logs', '容器'],
      aliases: ['看容器状态', 'docker 容器日志', '容器是否在跑'],
      naturalPhrases: ['看下 docker 容器状态', '容器为什么停了', 'docker ps 怎么看'],
      commandHints: ['docker ps -a', 'docker logs --tail 100', 'docker system prune'],
      taskTypeBoosts: ['generate-command', 'judge-environment', 'use-template', 'analyze-error'],
    },
    guide: {
      commandSummary:
        '先看整体容器状态和端口映射，再看近期日志，不要先删容器或执行 prune。',
      environmentSummary:
        'Docker Desktop 场景默认先在 Windows 本机看；如果 daemon 实际跑在远端主机，再切到 SSH。',
      errorSummary:
        '容器状态异常时，最常见的是已退出、端口映射错误或启动命令失败。',
      reasoning: ['`docker ps -a` 先告诉你容器是否真的在跑。', '`docker logs` 用来定位退出原因，而不是盲目重建。'],
      supportingSignals: ['输入中出现 docker、container、docker ps、docker logs 等词。'],
      conflictingSignals: ['如果 Docker daemon 在远端 Linux，本机只能作为 SSH 入口。'],
      probableCauses: ['容器已退出', '端口映射或环境变量配置错误', '镜像启动命令本身失败'],
      differenceNotes: ['命令在 Windows、WSL、Bash 中几乎一致，差异主要在 daemon 到底跑在哪。'],
      nextSteps: ['先看整体状态，再看最近日志。', '未定位前不要直接 prune 或 rm。'],
      handoffSteps: ['如果 daemon 在远端，再转到 SSH 会话执行同样的状态检查。'],
      riskLevel: 'medium',
      recommendedShells: ['powershell', 'cmd', 'wsl'],
    },
  },
]

export const builtInWorkflows = workflowCatalog.map((entry) => entry.template)
