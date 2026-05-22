<p align="center">
  <a href="https://klaw.at">
    <img src="public/logo.png" alt="KLAW logo" width="120">
  </a>
</p>

<h1 align="center">KLAW</h1>

<p align="center">
  Local AI agents, visible in your terminal.
</p>

<p align="center">
  <a href="https://klaw.at">klaw.at</a>
  ·
  <a href="https://github.com/janpaul80/klaw">GitHub</a>
  ·
  <a href="https://www.npmjs.com/package/@phartmann80/klaw">npm</a>
</p>

KLAW is an early local-first AI runtime for running coding agents with your own models and APIs. It is a terminal tool, not a SaaS dashboard. The goal is to make every step visible: the plan, the files written, the shell commands requested, the command output, and the errors if something fails.

KLAW v0.2.0 focuses on removing demo shortcuts and making the CLI more honest. It can ask a provider for a structured plan, write files inside a selected workspace, run real shell commands, capture failures, and attempt one basic repair.

## What KLAW Is

KLAW is built for developers who want a small, inspectable local agent runtime.

- Terminal-first: work happens in your shell.
- Local-first: generated projects live on your machine.
- Transparent: commands, file writes, and errors are printed.
- Hackable: plain Node.js modules, small agents, no heavy framework.
- Bring-your-own-provider: v0.2.0 starts with OpenAI via `OPENAI_API_KEY`.

KLAW is not a cloud workspace, enterprise orchestrator, autonomous black box, or CoderXP clone.

## Install

KLAW is published as:

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
klaw run "build a simple Next.js landing page"
```

To persist the API key for future PowerShell sessions:

```powershell
[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "your_openai_api_key", "User")
```

### WSL or Linux

```bash
node --version
npm --version
npm install -g @phartmann80/klaw
export OPENAI_API_KEY="your_openai_api_key"
klaw doctor
klaw init
klaw run "build a simple Next.js landing page"
```

To persist the key:

```bash
echo 'export OPENAI_API_KEY="your_openai_api_key"' >> ~/.bashrc
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
klaw run "build a simple Next.js landing page"
```

For zsh:

```bash
echo 'export OPENAI_API_KEY="your_openai_api_key"' >> ~/.zshrc
source ~/.zshrc
```

## Quick Start

```bash
klaw init
klaw doctor
klaw run "build a simple Next.js landing page"
```

Use a specific workspace:

```bash
klaw run "build a landing page" --workspace ./my-app
```

By default, KLAW creates generated workspaces outside the repository:

```text
~/.klaw/workspaces
```

## Commands

```bash
klaw doctor
klaw init
klaw run "task"
klaw run "task" --workspace ./my-app
klaw logs
```

Planned next:

```bash
klaw config
klaw memory
klaw providers
klaw replay
```

## Configuration

`klaw init` writes `~/.klaw/config.json` using `os.homedir()` so it resolves correctly on Windows, macOS, WSL, and Linux.

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
  "memory": {
    "enabled": true
  }
}
```

## How It Works

KLAW runs a small agent chain:

- ArchitectAgent asks the provider for a structured JSON plan.
- WriterAgent asks the provider for complete file contents and writes them safely inside the workspace.
- ShellAgent asks permission before shell commands, streams stdout/stderr, and returns exit codes.
- FixerAgent captures a failed `npm install` or `npm run dev`, asks the provider for one minimal file repair, applies it, and retries once.

Expected success path:

```bash
klaw run "build a simple Next.js landing page"
```

KLAW should plan the project, write files, request permission, run `npm install`, run `npm run dev`, detect the dev server if it starts, and report the workspace path and status honestly.

## Provider Setup

v0.2.0 supports OpenAI first.

```bash
OPENAI_API_KEY=your_openai_api_key
```

If the key is missing, `klaw doctor` reports it:

```text
[KLAW][DOCTOR] OPENAI_API_KEY: missing
```

If the key is missing during a run, KLAW fails clearly instead of falling back to fake output.

Future provider targets:

- Ollama
- Anthropic
- Langdock
- Gemini

## Logs and Memory

KLAW keeps the log surface simple:

```text
~/.klaw/memory.md
~/.klaw/runs/<timestamp>/run.md
~/.klaw/runs/<timestamp>/events.jsonl
```

The goal is useful execution history without turning KLAW into a dashboard.

## Security Notes

KLAW runs shell commands locally. Treat it like any tool that can modify files and execute commands on your machine.

- Shell commands require approval by default.
- File writes are blocked outside the selected workspace.
- Existing files are backed up before overwrite.
- API keys should come from your environment.
- Secrets should not be written to memory or logs.
- Do not run untrusted tasks in a sensitive directory.

## Known Limitations

KLAW v0.2.0 is still early.

- OpenAI is the only real provider in this release.
- The repair loop is intentionally simple and only retries once.
- KLAW is not a secure sandbox for untrusted code.
- Long-running dev server handling is basic.
- The CLI is useful, but not production-ready autonomous engineering software.

## Roadmap

- v0.2.1: bug fixes only
- v0.2.2: Windows/Linux path hardening
- v0.3.0: Ollama provider
- v0.4.0: Anthropic or Langdock provider

## Links

- Website: https://klaw.at
- GitHub: https://github.com/janpaul80/klaw
- npm: https://www.npmjs.com/package/@phartmann80/klaw

## License

MIT
