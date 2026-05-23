const fs = require('fs');
const path = require('path');
const ArchitectAgent = require('./agents/architect');
const FileWriterAgent = require('./agents/writer');
const ShellAgent = require('./agents/shell');
const FixerAgent = require('./agents/fixer');
const { appendMemory } = require('./memory');

async function executeTask(task, options = {}) {
  const config = options.config;
  const workspace = path.resolve(options.workspace);
  const provider = options.provider;

  fs.mkdirSync(workspace, { recursive: true });
  console.log(`[KLAW][SYSTEM] Workspace: ${workspace}`);
  if (config.memory?.enabled !== false) appendMemory('task', `Received task: ${task}`);

  const architect = new ArchitectAgent(provider);
  const plan = await architect.plan(task, { workspace, config });

  const writer = new FileWriterAgent(workspace, provider, config);
  const files = [];

  const shell = new ShellAgent(config);
  const fixer = new FixerAgent(workspace, provider);
  const commandResults = [];
  const commands = options.commands || collectPlanCommands(plan);

  for (const step of plan.steps.filter((entry) => entry.agent === 'writer')) {
    const written = await writer.generateAndWrite(plan, task, step);
    files.push(...written);
  }

  for (const command of commands) {
    const result = await shell.run(command, { cwd: workspace, reason: `Run ${command} for generated project` });
    commandResults.push({ command, ...result });

    if (result.code !== 0 && (command === 'npm install' || command === 'npm run dev')) {
      const fixed = await fixer.fixAndRetry({
        command,
        error: result,
        plan,
        task,
        runner: () => shell.run(command, { cwd: workspace, reason: `Retry ${command} after FixerAgent changes` })
      });
      commandResults.push({ command, retry: true, ...fixed });
      if (fixed.code !== 0) {
        console.log(`[KLAW][SYSTEM] Failed after one fixer retry: ${command}`);
        return { status: 'failed', workspace, plan, files, commands: commandResults };
      }
    } else if (result.code !== 0) {
      return { status: 'failed', workspace, plan, files, commands: commandResults };
    }
  }

  console.log(`[KLAW][SYSTEM] Completed. Workspace: ${workspace}`);
  return { status: 'completed', workspace, plan, files, commands: commandResults };
}

function collectPlanCommands(plan) {
  return plan.steps
    .filter((step) => step.agent === 'shell')
    .flatMap((step) => step.commands || []);
}

module.exports = { executeTask, collectPlanCommands };
