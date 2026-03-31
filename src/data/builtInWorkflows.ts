import type { WorkflowTemplate } from '../types'

export const builtInWorkflows: WorkflowTemplate[] = [
  {
    id: 'port-occupancy',
    name: '端口占用排查',
    category: '开发排障',
    description: '定位端口占用进程，判断是否可以结束，并给出跨 shell 命令。',
    recommendedEnvironment: 'windows-local',
    supportedShells: ['powershell', 'cmd', 'wsl'],
    tags: ['端口', '本机', 'Java', 'Node'],
    samplePrompt: '查看 8103 端口被谁占用',
    steps: [
      {
        id: 'port-check',
        title: '先确认端口是否在本机被监听',
        detail: '如果服务跑在 Windows 本机，优先在本机排查，再决定是否需要切到 WSL。',
        environment: 'windows-local',
        commands: [
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
        ],
      },
      {
        id: 'port-kill',
        title: '确认进程后再决定是否结束',
        detail: '只有确定是无效残留进程时才执行结束动作。',
        environment: 'windows-local',
        risk: {
          id: 'risk-stop-process',
          level: 'medium',
          title: '结束进程可能中断本地服务',
          detail: '先核对 PID 属于哪个应用，再决定是否停止。',
          saferAlternative: '先改用临时端口启动当前服务。',
        },
      },
    ],
  },
  {
    id: 'maven-build-failure',
    name: 'Maven 构建失败排查',
    category: '构建排障',
    description: '按依赖、仓库、JDK 和网络顺序排查常见构建失败。',
    recommendedEnvironment: 'windows-local',
    supportedShells: ['powershell', 'cmd'],
    tags: ['Maven', 'Java', '构建'],
    samplePrompt: 'mvn clean package 失败，帮我排查',
    steps: [
      {
        id: 'maven-version',
        title: '确认 Maven 与 JDK',
        detail: '先检查版本和环境变量，避免直接怀疑业务代码。',
        environment: 'windows-local',
        commands: [
          {
            shell: 'powershell',
            label: 'PowerShell',
            command: 'mvn -v',
            available: true,
          },
          {
            shell: 'cmd',
            label: 'cmd',
            command: 'mvn -v',
            available: true,
          },
        ],
      },
      {
        id: 'maven-settings',
        title: '检查私服与 settings.xml',
        detail: '如果是公司私服问题，优先确认 settings.xml、网络代理和仓库凭据。',
        environment: 'windows-local',
      },
    ],
  },
  {
    id: 'ssh-connection',
    name: 'SSH 连接失败排查',
    category: '远端运维',
    description: '定位是网络、账号、密钥还是远端服务问题。',
    recommendedEnvironment: 'remote-linux',
    supportedShells: ['powershell', 'cmd', 'wsl'],
    tags: ['SSH', 'Linux', '网络'],
    samplePrompt: 'SSH 连不上 10.0.0.15',
    steps: [
      {
        id: 'ssh-basic-check',
        title: '先确认网络与端口可达',
        detail: '优先区分是网络不通，还是 SSH 服务本身有问题。',
        environment: 'windows-local',
        commands: [
          {
            shell: 'powershell',
            label: 'PowerShell',
            command: 'Test-NetConnection 10.0.0.15 -Port 22',
            available: true,
          },
          {
            shell: 'cmd',
            label: 'cmd',
            command: 'ssh -v user@10.0.0.15',
            available: true,
          },
          {
            shell: 'wsl',
            label: 'WSL',
            command: 'ssh -v user@10.0.0.15',
            available: true,
          },
        ],
      },
      {
        id: 'ssh-server-check',
        title: '如果能连到机器，再到远端检查 sshd',
        detail: '这一步已经不在 Windows 本机，而是在服务器上继续排查。',
        environment: 'remote-linux',
        commands: [
          {
            shell: 'bash',
            label: 'Bash',
            command: 'sudo systemctl status sshd',
            available: true,
          },
        ],
      },
    ],
  },
]
