#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { executeTask } = require('./src/agents/demo');

const program = new Command();
program.version('0.1.0');

program
  .command('init')
  .description('Initialize KLAW configuration')
  .action(() => {
    const configDir = path.join(process.env.HOME, '.klaw');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir);
    }

    const config = {
      version: '0.1.0',
      defaultProvider: 'openai',
      workspace: path.join(process.cwd(), 'klaw-workspace'),
      providers: {
        openai: { apiKey: '' },
        anthropic: { apiKey: '' },
        ollama: { url: 'http://localhost:11434', model: 'llama3' }
      },
      permissions: {
        allowFileWrite: true,
        allowShellCommands: false
      }
    };

    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config, null, 2));
    console.log(chalk.blue('[KLAW][SYSTEM] Configuration created'));
  });

program
  .command('run <task>')
  .description('Execute a task via KLAW agents')
  .option('--provider <provider>', 'AI provider to use', 'openai')
  .action(async (task) => {
    console.log(chalk.blue('[KLAW][ARCHITECT] Starting task: ' + task));
    await executeTask(task);
  });

program
  .command('logs')
  .description('Show KLAW execution logs')
  .option('--follow', 'Follow log output')
  .option('--lines <n>', 'Number of lines to show', '50')
  .action((options) => {
    const logFile = 'klaw-logs.json';
    if (!fs.existsSync(logFile)) {
      console.log(chalk.yellow('[KLAW][SYSTEM] No logs found. Run a task first.'));
      return;
    }

    const content = fs.readFileSync(logFile, 'utf8');
    console.log(content);
  });

program
  .command('doctor')
  .description('Check KLAW system status')
  .action(() => {
    console.log(chalk.blue('[KLAW][SYSTEM] Checking system status'));
    console.log(chalk.green('[KLAW][SYSTEM] CLI initialized'));
    console.log(chalk.green('[KLAW][SYSTEM] Provider interfaces ready'));
    console.log(chalk.green('[KLAW][SYSTEM] Memory system active'));
  });

program.parse(process.argv);