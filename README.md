# KLAW

Local AI runtime for running agents with your own models and APIs.

KLAW is a lightweight local-first runtime that executes agents visibly in the terminal.

It focuses on:
- transparent execution
- visible shell actions
- workspace isolation
- simple agent flows
- developer control

No dashboards.
No cloud dependency.
No hidden orchestration layers.

## Install

npm install -g @phartmann80/klaw

## Quickstart

Initialize KLAW:

```bash
klaw init
klaw doctor
klaw run "build a Next.js landing page"

What it does

KLAW runs tasks through a simple agent chain.

Architect: plans task steps
Writer: creates and modifies files
Shell: runs commands with permission prompts
Fixer: handles basic errors and retries

Current features
Local-first execution
Workspace isolation
Shell permission prompts
Live terminal output
Human-readable memory log
Minimal agent runtime
Example output
[KLAW][SYSTEM] Checking system status
[KLAW][SYSTEM] CLI initialized
[KLAW][ARCHITECT] Starting task: build a Next.js landing page
[KLAW][WRITER] Created: package.json
[KLAW][WRITER] Created: pages/index.js
[KLAW][SYSTEM] Demo complete
Philosophy

KLAW is built to stay small, transparent, and hackable.

No dashboards.
No cloud lock-in.
No heavy orchestration layer.

Package

npm: https://www.npmjs.com/package/@phartmann80/klaw

GitHub: https://github.com/janpaul80/klaw

Author

Built by Paul Hartmann
GitHub: @janpaul80

License

MIT


Then save it and push:

git add README.md assets/
git commit -m "add README screenshots"
git push origin main
git add README.md
git commit -m "improve README"
git push origin main


## Screenshots

### System Check

![KLAW doctor](assets/klaw-doctor.jpg)

### Initialization

![KLAW init](assets/klaw-init.jpg)

### Task Execution

![KLAW run](assets/klaw-run.jpg)

''' bash
git add README.md assets/
git commit -m "add README screenshots"
git push origin main