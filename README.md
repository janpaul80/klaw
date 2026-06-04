<p align="center">
  <a href="https://www.klaw.at/">
    <img src="public/logo.png" alt="KLAW logo" width="120">
  </a>
</p>

<h1 align="center">KLAW</h1>

<p align="center">
  Local AI runtime for transparent agent execution.
</p>

<p align="center">
  <a href="https://www.klaw.at/">klaw.at</a>
  ·
  <a href="https://github.com/janpaul80/klaw">GitHub</a>
  ·
  <a href="https://www.npmjs.com/package/@phartmann80/klaw">npm</a>
</p>

KLAW is a local-first AI runtime that helps developers execute tasks through transparent terminal-based agents. Instead of hiding decisions behind a cloud service, KLAW keeps planning, file creation, shell execution, and repair attempts visible and understandable.

## What is KLAW?

KLAW is a local-first AI runtime that helps developers execute tasks through transparent terminal-based agents.

- Run AI agents locally
- Write files
- Execute shell commands
- Keep everything visible in your terminal

KLAW is not a cloud workspace, enterprise orchestrator, autonomous black box, or SaaS product. It is a practical developer tool for building with AI locally.

## Install

```bash
npm install -g @phartmann80/klaw
```

### Windows PowerShell

```powershell
node --version
npm --version
npm install -g @phartmann80/klaw
$env:OPENAI_API_KEY="your_openai_api_key"
klaw doctor
klaw init
klaw run "create a hello script"
```

To persist the API key:

```powershell
[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "your_key", "User")
```

### WSL or Linux

```bash
node --version
npm --version
npm install -g @phartmann80/klaw
export OPENAI_API_KEY="your_openai_api_key"
klaw doctor
klaw init
klaw run "create a hello script"
```

To persist the key:

```bash
echo 'export OPENAI_API_KEY="your_key"' >> ~/.bashrc
source ~/.bashrc
```

### macOS

```bash
node --version
npm --version
npm install -g @phartmann80/klaw
export OPENAI_API_KEY="your_openai_api_key"
klaw doctor
klaw init
klaw run "create a hello script"
```

## Quick Start

```bash
klaw init
klaw doctor
klaw run "create a hello script"
```

Use a specific workspace:

```bash
klaw run "build a landing page" --workspace ./my-app
```

By default, KLAW creates workspaces in:

```text
~/.klaw/workspaces
```

## Agent Workflow

```
User Prompt
    ↓
Architect (generates plan)
    ↓
Writer (creates files)
    ↓
Shell (runs commands)
    ↓
Fixer (repairs failures)
    ↓
Workspace (output)
```

## Supported Providers

- OpenAI
- OpenRouter
- Ollama (local models)
- Anthropic (Claude)
- Gemini
- Langdock

## v0.3.0 Features

### Architect Reliability
- Strict schema validation for plan output
- Multi-pass JSON recovery from LLM responses
- Bounded retry strategy with error classification

### Non-interactive Mode
- `--yes` — Auto-approve shell commands and file writes
- `--ci` — Fully non-interactive for CI/CD pipelines

### Benchmark Runner
- `node benchmarks/run.js` — Run benchmark suite
- Isolated workspaces per benchmark
- Scorecards at `~/.klaw/benchmarks/scorecards/`

### Known Limitations (v0.3.0)
- Streaming responses not yet implemented
- Gemini (Google)
- Langdock

Configure your provider in `~/.klaw/config.json`:

```json
{
  "provider": "openai",
  "model": "gpt-4.1-mini"
}
```

For Ollama (local):

```json
{
  "provider": "ollama",
  "model": "llama3.2"
}
```

## Commands

```bash
klaw doctor      # Check system status
klaw init       # Initialize config
klaw run "task" # Run a task
klaw logs       # View execution logs
klaw config     # Show configuration
```

## Configuration

Default config in `~/.klaw/config.json`:

```json
{
  "version": "0.2.0",
  "provider": "openai",
  "model": "gpt-4.1-mini",
  "workspaceRoot": "~/.klaw/workspaces",
  "permissions": {
    "fileWrite": true,
    "shell": "prompt"
  },
  "fixer": {
    "enabled": true,
    "retries": 1
  },
  "memory": {
    "enabled": true
  }
}
```

## Features

- Local-first execution
- Transparent terminal logs
- Real shell command execution
- Workspace isolation
- Memory logging
- Multiple provider support
- Open-source (MIT)

## Security Notes

KLAW runs shell commands locally. Treat it like any tool that can modify files and execute commands on your machine.

- Shell commands require approval by default
- File writes are blocked outside the workspace
- Existing files are backed up before overwrite
- API keys should come from your environment
- Do not run untrusted tasks in sensitive directories

## Known Limitations

- KLAW is still early software
- The repair loop is simple (one retry)
- Not a secure sandbox for untrusted code
- Not production-ready autonomous engineering software

## Links

- Website: https://www.klaw.at/
- GitHub: https://github.com/janpaul80/klaw
- npm: https://www.npmjs.com/package/@phartmann80/klaw

## License

MIT