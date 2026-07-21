#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { defaultConfig, writeConfig, readConfig, resolveWorkspace, expandHome, configPath } = require('./src/config');
const { memoryPath } = require('./src/memory');
const { createProvider } = require('./src/providers');
const { executeTask } = require('./src/runtime');
const packageJson = require('./package.json');

const program = new Command();
program.version(packageJson.version);

function commandExists(command) {
  const { spawnSync } = require('child_process');
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `${command} --version`], { stdio: 'ignore' })
    : spawnSync(command, ['--version'], { shell: false, stdio: 'ignore' });
  return result.status === 0;
}

function commandVersion(command) {
  const { spawnSync } = require('child_process');
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `${command} --version`], { encoding: 'utf8' })
    : spawnSync(command, ['--version'], { shell: false, encoding: 'utf8' });
  if (result.status !== 0) return null;
  return String(result.stdout || result.stderr).trim().split(/\r?\n/)[0];
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
    console.log(`[KLAW][INIT] Provider: ${config.provider}`);
    console.log(`[KLAW][INIT] Model: ${config.model}`);
    console.log(`[KLAW][INIT] Shell permission: ${config.permissions.shell}`);
    console.log('[KLAW][INIT] Next: set OPENAI_API_KEY, then run `klaw doctor` and `klaw run "build a simple Next.js landing page"`');
  });

program
  .command('run <task>')
  .description('Execute a task via KLAW agents')
  .option('--provider <provider>', 'AI provider to use')
  .option('--model <model>', 'AI model to use')
  .option('--workspace <path>', 'Workspace directory for this run')
  .option('--yes', 'Approve shell commands and file writes without prompting')
  .option('--ci', 'Fully non-interactive mode (no prompts, fails if approval required)')
  .action(async (task, options) => {
    try {
      const config = readConfig();
      if (options.provider) {
        config.provider = options.provider;
      }
      if (options.model) {
        config.model = options.model;
      }
      const nonInteractive = Boolean(options.ci);

      // Handle --yes and --ci flags
      if (options.yes || options.ci) {
        config.permissions.shell = 'allow';
        config.permissions.fileWrite = true;
      }

      const workspace = resolveWorkspace(config, options.workspace, task);
      const provider = createProvider(config);
      const result = await executeTask(task, { config, workspace, provider, nonInteractive });

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
    const logFile = memoryPath();
    if (!fs.existsSync(logFile)) {
      console.log(chalk.yellow('[KLAW][SYSTEM] No logs found. Run a task first.'));
      return;
    }

    const lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/);
    console.log(lines.slice(-Number(options.lines)).join('\n'));
  });

program
  .command('config')
  .description('Show KLAW configuration')
  .action(() => {
    const config = readConfig();
    console.log(JSON.stringify(config, null, 2));
  });

program
  .command('doctor')
  .description('Check KLAW system status')
  .action(async () => {
    const config = readConfig();
    const workspaceRoot = expandHome(config.workspaceRoot);
    fs.mkdirSync(workspaceRoot, { recursive: true });
    const npmVersion = commandVersion('npm');
    const gitVersion = commandVersion('git');

    const checks = [
      ['Package', packageJson.version, true],
      ['OS', `${os.platform()} ${os.release()} (${os.arch()})`, true],
      ['Node', process.version, true],
      ['npm', npmVersion || 'missing', Boolean(npmVersion)],
      ['Git', gitVersion || 'missing', Boolean(gitVersion)],
      ['Config file', fs.existsSync(configPath()) ? configPath() : 'not created yet', fs.existsSync(configPath())],
      ['Provider', config.provider, true],
      ['Model', config.model || 'default', true]
    ];

    const providerKeys = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      langdock: 'LANGDOCK_API_KEY',
      gemini: 'GEMINI_API_KEY',
      ollama: 'local'
    };

    const apiKeyEnv = providerKeys[config.provider];
    const apiKeyValue = process.env[apiKeyEnv] || config.apiKey;
    checks.push([apiKeyEnv, apiKeyValue ? 'configured' : 'missing', Boolean(apiKeyValue)]);

    if (config.provider === 'ollama') {
      try {
        const { spawnSync } = require('child_process');
        const result = spawnSync('curl', ['-s', 'http://localhost:11434/api/tags'], { encoding: 'utf8', timeout: 3000 });
        const ollamaOk = result.status === 0 && result.stdout.includes('models');
        checks.push(['Ollama server', ollamaOk ? 'running' : 'not running', ollamaOk]);
      } catch (_) {
        checks.push(['Ollama server', 'not running', false]);
      }
    }

    checks.push(['Workspace root', workspaceRoot, true]);
    checks.push(['Workspace writable', isWritable(workspaceRoot), isWritable(workspaceRoot)]);

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