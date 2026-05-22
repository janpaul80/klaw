# KLAW

KLAW is a local-first AI runtime for running transparent coding agents from your terminal.

v0.2.0 turns the original demo CLI into a practical local runtime that can accept a task, ask a model for a structured plan, write real files into a workspace, run real shell commands, capture failures, and attempt one basic repair when `npm install` or `npm run dev` fails.

## Install

```bash
npm install -g @phartmann80/klaw
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

By default, KLAW creates generated workspaces outside the repo:

```text
~/.klaw/workspaces
```

## Configuration

`klaw init` writes:

```json
{
  "provider": "openai",
  "model": "gpt-4.1-mini",
  "workspaceRoot": "~/.klaw/workspaces",
  "permissions": {
    "shell": "prompt",
    "fileWrite": true
  }
}
```

Set your API key before running provider-backed tasks:

```bash
set OPENAI_API_KEY=your_key_here
```

## Agent Flow

- ArchitectAgent asks the configured provider for structured JSON plans.
- WriterAgent asks the provider for structured file contents and writes them inside the workspace.
- ShellAgent asks permission, runs commands for real, streams stdout/stderr, and returns exit codes.
- FixerAgent captures `npm install` or `npm run dev` failures, asks the provider for a minimal file fix, applies it, and retries once.

## Doctor

```bash
klaw doctor
```

Checks Node, npm, Git, config, provider, API key availability, and workspace writability.

## Project

- npm: https://www.npmjs.com/package/@phartmann80/klaw
- GitHub: https://github.com/janpaul80/klaw
- Site: https://klaw.at

## Logo

The KLAW logo is available at `assets/logo.png` and `public/logo.png`.

## Philosophy

KLAW stays small, local, transparent, and hackable.

No dashboards. No SaaS layer. No enterprise ceremony.

Built by Paul Hartmann.
