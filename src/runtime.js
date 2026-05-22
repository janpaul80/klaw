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
  const commands = options.commands || ['npm install', 'npm run dev'];

  fs.mkdirSync(workspace, { recursive: true });
  console.log(`[KLAW][SYSTEM] Workspace: ${workspace}`);
  appendMemory('task', `Received task: ${task}`);

  const architect = new ArchitectAgent(provider);
  const plan = await architect.plan(task);

  const writer = new FileWriterAgent(workspace, provider, config);
  const files = await writer.generateAndWrite(plan, task);

  const shell = new ShellAgent(config);
  const fixer = new FixerAgent(workspace, provider);
  const commandResults = [];

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

module.exports = { executeTask };
