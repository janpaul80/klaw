#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { defaultConfig, writeConfig, readConfig, resolveWorkspace, expandHome, configPath } = require('./src/config');
const { createProvider } = require('./src/providers');
const { executeTask } = require('./src/runtime');

const program = new Command();
program.version('0.2.0');

function commandExists(command) {
  const { spawnSync } = require('child_process');
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `${command} --version`], { stdio: 'ignore' })
    : spawnSync(command, ['--version'], { shell: false, stdio: 'ignore' });
  return result.status === 0;
}

program
  .command('init')
  .description('Initialize KLAW configuration')
  .action(() => {
    const config = defaultConfig();
    const file = writeConfig(config);
    fs.mkdirSync(expandHome(config.workspaceRoot), { recursive: true });
    console.log(chalk.blue('[KLAW][SYSTEM] Configuration created'));
    console.log(`[KLAW][SYSTEM] ${file}`);
    console.log(`[KLAW][SYSTEM] Workspace root: ${expandHome(config.workspaceRoot)}`);
  });

program
  .command('run <task>')
  .description('Execute a task via KLAW agents')
  .option('--provider <provider>', 'AI provider to use')
  .option('--workspace <path>', 'Workspace directory for this run')
  .option('--yes', 'Allow shell commands without prompting')
  .action(async (task, options) => {
    try {
      const config = readConfig();
      if (options.provider) config.provider = options.provider;
      if (options.yes) config.permissions.shell = 'allow';

      const workspace = resolveWorkspace(config, options.workspace, task);
      const provider = createProvider(config);
      const result = await executeTask(task, { config, workspace, provider });

      console.log(`[KLAW][SYSTEM] Status: ${result.status}`);
      console.log(`[KLAW][SYSTEM] Workspace path: ${result.workspace}`);
      process.exitCode = result.status === 'completed' ? 0 : 1;
    } catch (error) {
      console.error(chalk.red(`[KLAW][SYSTEM] ${error.message}`));
      process.exitCode = 1;
    }
  });

program
  .command('logs')
  .description('Show KLAW execution logs')
  .option('--lines <n>', 'Number of lines to show', '50')
  .action((options) => {
    const logFile = path.join(process.cwd(), 'memory.md');
    if (!fs.existsSync(logFile)) {
      console.log(chalk.yellow('[KLAW][SYSTEM] No logs found. Run a task first.'));
      return;
    }

    const lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/);
    console.log(lines.slice(-Number(options.lines)).join('\n'));
  });

program
  .command('doctor')
  .description('Check KLAW system status')
  .action(() => {
    const config = readConfig();
    const workspaceRoot = expandHome(config.workspaceRoot);
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const checks = [
      ['Node version', process.version, true],
      ['npm installed', commandExists('npm') ? 'available' : 'missing', commandExists('npm')],
      ['Git installed', commandExists('git') ? 'available' : 'missing', commandExists('git')],
      ['Config file', fs.existsSync(configPath()) ? configPath() : 'not created yet', fs.existsSync(configPath())],
      ['Provider', config.provider, config.provider === 'openai'],
      ['API key', process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY available' : 'OPENAI_API_KEY missing', Boolean(process.env.OPENAI_API_KEY)],
      ['Workspace writable', workspaceRoot, isWritable(workspaceRoot)]
    ];

    console.log(chalk.blue('[KLAW][SYSTEM] Doctor'));
    for (const [label, value, ok] of checks) {
      const icon = ok ? chalk.green('OK') : chalk.yellow('WARN');
      console.log(`[KLAW][DOCTOR] ${icon} ${label}: ${value}`);
    }
  });

function isWritable(directory) {
  try {
    const probe = path.join(directory, `.klaw-write-${Date.now()}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch (_) {
    return false;
  }
}

program.parse(process.argv);
