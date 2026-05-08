KLAW

Local AI runtime for running agents with your own models and APIs.

Usage

npx klaw init
npx klaw run "build a Next.js landing page"

How it works

KLAW executes tasks through a chain of agents. Each agent handles a specific part of the work.

Agents

Architect: Plans task steps
Writer: Creates and modifies files
Shell: Runs commands with permission prompts
Fixer: Handles basic errors and retries

Security

Workspace isolation by default
Permission prompts for shell commands
No file writes outside workspace root

Author

Built by Paul Hartmann
GitHub: @janpaul80

License

MIT
