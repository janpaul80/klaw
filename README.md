# KLAW

KLAW is a local AI agent runner for your terminal. You give it a task, it plans the work, creates files, and runs commands where you can see what is happening.

I made it local on purpose. The tool should be visible, simple to inspect, and easy to stop when you do not like what it is doing.

Website: [klaw.at](https://www.klaw.at/)  
npm: [@phartmann80/klaw](https://www.npmjs.com/package/@phartmann80/klaw)

## Install

```bash
npm install -g @phartmann80/klaw
```

Set a provider key:

```bash
export OPENAI_API_KEY=sk_...
export ANTHROPIC_API_KEY=sk_...
```

You can also use Ollama locally without an API key.

## Quick start

```bash
klaw doctor
klaw run "create a hello script"
```

KLAW creates a workspace under `~/.klaw/workspaces/`.

## What it does

- Plans a small task
- Writes files into a workspace
- Runs shell commands with approval
- Retries when a step fails
- Works with cloud providers or local Ollama models
- Supports non interactive mode for CI style runs

## Providers

KLAW can be configured for:

- OpenAI
- OpenRouter
- Anthropic
- Gemini
- Langdock
- Ollama

Example `~/.klaw/config.json`:

```json
{
  "provider": "openai",
  "model": "gpt-4.1-mini"
}
```

For Ollama:

```json
{
  "provider": "ollama",
  "model": "llama3.2"
}
```

## Useful commands

```bash
klaw doctor
klaw run "build a small landing page"
klaw run --yes "create a simple API"
klaw run --ci "run the test suite and fix failures"
```

## Status

Published package and active experiment. Use it in a scratch workspace first, review changes before keeping them, and do not give it secrets you would not paste into a terminal yourself.
