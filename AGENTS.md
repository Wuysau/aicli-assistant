# AGENTS.md

## Project overview
This project is a Windows-focused desktop tool named **Windows Terminal Workflow Assistant**.

It is **not** a terminal emulator and **not** a general-purpose coding agent.
It is a workflow tool for Windows developers and operators who use:
- PowerShell
- cmd
- WSL / Bash
- SSH into Linux hosts

The product focus is:
1. cross-shell command translation
2. execution-environment guidance
3. Windows-oriented troubleshooting workflows
4. risk warnings for dangerous commands
5. reusable built-in workflow templates

## Product boundaries
When making product or code decisions, keep the project scoped to these user jobs:

- show equivalent commands for PowerShell / cmd / Bash
- explain which environment a command should run in
- analyze common Windows/WSL/SSH troubleshooting cases
- provide built-in workflow templates for frequent tasks
- highlight risky commands and safer alternatives

Do NOT drift into:
- building a terminal emulator
- building a full coding agent like Codex / Claude Code
- editing arbitrary user codebases
- autonomous task execution
- automatic command execution without user confirmation
- broad chat-first assistant behavior

## MVP priorities
For V0.1, prioritize only these capabilities:

1. Cross-shell command generation
2. Environment judgment
3. Error/troubleshooting analysis
4. Built-in workflow templates
5. Risk warning display
6. Local history / recent actions

Prefer a small, reliable MVP over a broad but unstable feature set.

## Initial supported scenarios
Focus on high-frequency scenarios only.

Examples:
- find which process is using a port
- kill a process by port / pid
- count ERROR/WARN/500 lines in logs
- Maven package with tests skipped
- show git user/email
- analyze git push hook rejection
- analyze Java port conflict
- explain PowerShell execution policy issues
- basic SSH connection troubleshooting
- inspect Docker container status
- inspect systemctl service status
- view environment variables
- convert Windows paths to WSL paths

Do not expand beyond a tightly curated scenario list unless explicitly requested.

## Tech stack
Use:
- Tauri
- React
- TypeScript
- local-first architecture
- SQLite later when persistence becomes necessary

Assume the UI and business logic are primarily TypeScript-driven.
Use Rust only when needed for Tauri integration or desktop capabilities.

## Code organization
Prefer a simple, maintainable structure.

Expected top-level frontend folders:
- src/components
- src/pages or src/app
- src/services
- src/types
- src/mock
- src/data (if built-in workflows are stored locally)

If backend/native logic is needed, keep it inside:
- src-tauri

Do not introduce excessive abstraction early.

## UI guidance
The app should feel like a practical workflow tool, not a chat playground.

Prefer:
- clear task entry points
- structured results
- obvious shell/environment labels
- copy-friendly command blocks
- visible risk level badges
- built-in workflow cards

Avoid:
- overly generic chatbot layouts
- flashy visual design
- unnecessary animations
- hidden key actions

## AI / mock architecture
Before connecting a real model API:
- implement mock services first
- keep output structures strongly typed
- use a unified result schema where possible

For any AI integration, prefer constrained, structured outputs.
Do not design around unconstrained free-form chat.

## Safety rules
Never auto-run dangerous commands.
Never assume the user wants destructive actions executed.
For risky commands, always:
- explain why the command is risky
- show impact scope
- mention reversibility when relevant
- offer safer alternatives if possible

## Development workflow
When making changes:
1. inspect the current structure first
2. preserve project scope
3. make the smallest reasonable change
4. explain what changed and why
5. avoid unrelated refactors

## Definition of done
A task is only done when:
- the code matches the scoped product direction
- the UI is usable for the target workflow
- the result is understandable to a Windows developer
- types are clear enough for future iteration
- no unnecessary complexity was introduced