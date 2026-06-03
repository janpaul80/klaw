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
  const nonInteractive = options.nonInteractive || false;

  fs.mkdirSync(workspace, { recursive: true });
  console.log(`[KLAW][SYSTEM] Workspace: ${workspace}`);
  console.log(`[KLAW][SYSTEM] Mode: ${nonInteractive ? 'non-interactive' : 'interactive'}`);
  if (config.memory?.enabled !== false) appendMemory('task', `Received task: ${task}`);

  const architect = new ArchitectAgent(provider, config);
  const plan = await architect.plan(task, { workspace, config });

  const writer = new FileWriterAgent(workspace, provider, config, { nonInteractive });
  const shell = new ShellAgent(config, { nonInteractive });
  const fixer = new FixerAgent(workspace, provider);
  const files = [];
  const commandResults = [];
  const commands = options.commands || collectPlanCommands(plan);

  for (const step of plan.steps.filter((entry) => entry.agent === 'writer')) {
    const written = await writer.generateAndWrite(plan, task, step);
    files.push(...written);
  }

  let retryCount = 0;
  const maxRetries = config.fixer?.retries ?? 1;
  const fixerEnabled = config.fixer?.enabled !== false;

  for (const command of commands) {
    const result = await shell.run(command, { cwd: workspace, reason: `Run ${command} for generated project` });
    commandResults.push({ command, ...result });

    if (result.code !== 0 && fixerEnabled && retryCount < maxRetries) {
      retryCount++;
      const fixed = await fixer.fixAndRetry({
        command,
        error: result,
        plan,
        task,
        runner: () => shell.run(command, { cwd: workspace, reason: `Retry ${command} after FixerAgent changes` })
      });
      commandResults.push({ command, retry: true, ...fixed });
      if (fixed.code !== 0) {
        console.log(`[KLAW][SYSTEM] Failed after fixer retry ${retryCount}/${maxRetries}: ${command}`);
        return { status: 'failed', workspace, plan, files, commands: commandResults };
      }
      console.log(`[KLAW][SYSTEM] Fixed and succeeded on retry ${retryCount}`);
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