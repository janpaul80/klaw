# KLAW

KLAW is a local AI agent runner built for your terminal. You give it a task; it plans the steps, generates files, and executes commands, keeping everything fully visible as it runs.

I designed KLAW to be local-first on purpose. Your AI coding assistant should be transparent, easy to inspect, and simple to stop if it starts doing something unexpected.

Website: [klaw.at](https://www.klaw.at/)  
npm: [@phartmann80/klaw](https://www.npmjs.com/package/@phartmann80/klaw)

## Installation

Install KLAW globally:

```bash
npm install -g @phartmann80/klaw
```

Set your provider API keys:

```bash
export OPENAI_API_KEY=sk_...
export ANTHROPIC_API_KEY=sk_...
```

*(You can also use Ollama to run models locally, which requires no API keys.)*

## Quick Start

Check your system status and initialize:

```bash
klaw doctor
klaw run "create a hello script"
```

This creates a local workspace directory at `~/.klaw/workspaces/` to hold your projects.

## Capabilities

- Plans tasks using structured JSON models
- Writes files cleanly inside the designated workspace
- Runs shell commands after asking for your explicit approval
- Automatically repairs errors when builds fail
- Supports multiple providers, including local Ollama setups
- Offers non-interactive modes for automated CI environments

## Providers

Configure your model settings in `~/.klaw/config.json`:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini"
}
```

For a local Ollama configuration:

```json
{
  "provider": "ollama",
  "model": "llama3.2"
}
```

## Useful Commands

Check your runtime environment:
```bash
klaw doctor
```

Run a task interactively:
```bash
klaw run "build a simple express backend"
```

Auto-approve commands:
```bash
klaw run --yes "create a hello script"
```

Run non-interactively in a CI pipeline:
```bash
klaw run --ci "run tests and fix failures"
```

## MCP Server Support

Klaw supports the Model Context Protocol (MCP) as an inline stdio server. This lets you connect Klaw to other LLM hosts (such as Claude Desktop or Cursor) so they can run Klaw agents directly as tools.

### Claude Desktop Configuration

Add Klaw to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "klaw": {
      "command": "npx",
      "args": ["-y", "@phartmann80/klaw", "mcp"]
    }
  }
}
```

### Exposed Tools

- `klaw_run`: Runs a coding agent loop to complete a software development task.
- `klaw_doctor`: Diagnoses and prints local Klaw environment details.

## Safety and Status

KLAW is an active experiment and a published NPM package. Since it runs shell commands directly on your local system, you should always run it in a scratch workspace first. Review its planned actions before approving them; never give the CLI credentials or secrets you wouldn't paste into a public prompt.
