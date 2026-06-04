<p align="center">
  <a href="https://www.klaw.at/">
    <img src="public/logo.png" alt="KLAW logo" width="120">
  </a>
</p>

<h1 align="center">KLAW</h1>

<p align="center">
  Run AI agents in your terminal. No cloud. No hidden decisions.
</p>

<p align="center">
  <a href="https://www.klaw.at/">klaw.at</a>
  ·
  <a href="https://github.com/janpaul80/klaw">GitHub</a>
  ·
  <a href="https://www.npmjs.com/package/@phartmann80/klaw">npm</a>
</p>

## What is this?

KLAW runs AI agents on your machine. You give it a task, it plans, creates files, and runs commands—in your terminal, visible the whole time.

It's not a cloud service. It's not an autonomous coding bot. It's a tool that runs locally and shows you everything it's doing.

## Install

```bash
npm install -g @phartmann80/klaw
```

Then set your API key:

```bash
# For OpenAI
export OPENAI_API_KEY=sk_...

# For Anthropic
export ANTHROPIC_API_KEY=sk_...

# Or use Ollama locally (no API key needed)
```

Run `klaw doctor` to check your setup:

```bash
$ klaw doctor
[KLAW][SYSTEM] Doctor
[KLAW][DOCTOR] OK Package: 0.3.0
[KLAW][DOCTOR] OK Provider: openai
[KLAW][DOCTOR] OK Workspace writable: true
[KLAW][DOCTOR] WARN OPENAI_API_KEY: missing
```

The key is missing—that's expected until you set it.

## Quick start

```bash
klaw run "create a hello script"
```

This creates a new directory in `~/.klaw/workspaces/` with your project.

## Run a Next.js app

```bash
klaw run "build a Next.js landing page"
cd /path/to/workspace
npm install
npm run dev
```

## How it works

```
you: "build a landing page"
  → Architect: makes a plan
  → Writer: creates files
  → Shell: runs npm install, npm run dev
  → Fixer: retries if something breaks
```

You see every step in your terminal.

## Providers

KLAW works with:

- OpenAI
- OpenRouter
- Anthropic
- Gemini
- Langdock
- Ollama (runs locally, no API key needed)

Set your provider in `~/.klaw/config.json`:

```json
{
  "provider": "openai",
  "model": "gpt-4.1-mini"
}
```

For local models:

```json
{
  "provider": "ollama",
  "model": "llama3.2"
}
```

## CI/CD

Use `--yes` to auto-approve commands, or `--ci` for fully non-interactive mode:

```bash
# Auto-approve everything
klaw run "create a script" --yes

# Fail if approval would be needed
klaw run "create a script" --ci
```

## Commands

```bash
klaw doctor      # Check your setup
klaw init       # Create config
klaw run "task" # Run a task
klaw logs       # Show logs
klaw config     # Show config
```

## Defaults

Permissions are strict by default—KLAW asks before running shell commands or writing files.

Edit `~/.klaw/config.json` to change this:

```json
{
  "provider": "openai",
  "permissions": {
    "shell": "allow",   # don't ask
    "fileWrite": true  # allow writes
  }
}
```

## What works

- Creating Next.js, React, Express, Node.js projects
- Running npm commands
- File generation from AI
- Multiple providers
- Retry on failure (simple retry loop)

## What doesn't work yet

- Streaming responses
- Complex multi-file edits (it rewrites files)
- Advanced retry logic

It's early software. It's useful for straightforward tasks like "build a landing page" or "create an API endpoint."

## Benchmarks

Run the benchmark suite to test AI output quality:

```bash
node benchmarks/run.js
```

Scorecards go to `~/.klaw/benchmarks/scorecards/`.

## Security

KLAW runs shell commands locally. It can create and delete files in its workspace.

- It asks before running commands (by default)
- It only writes to its workspace directory
- Your API key stays in your environment
- Don't run untrusted tasks in sensitive directories

## Links

- Website: https://www.klaw.at/
- GitHub: https://github.com/janpaul80/klaw

## License

MIT