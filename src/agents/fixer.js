const fs = require('fs');
const path = require('path');
const FileWriterAgent = require('./writer');
const { appendMemory } = require('../memory');

function readIfExists(workspace, filePath) {
  const fullPath = path.join(workspace, filePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
}

class FixerAgent {
  constructor(workspaceRoot, provider) {
    this.workspaceRoot = workspaceRoot;
    this.provider = provider;
  }

  async fixAndRetry({ command, error, plan, task, runner }) {
    console.log(`[KLAW][FIXER] Captured failure from ${command}`);
    appendMemory('error', `${command}: ${error.stderr || error.error || error.code}`);

    const files = await this.provider.generateJson({
      system: [
        'You are KLAW FixerAgent.',
        'Return only a JSON array of file replacements: [{"path":"package.json","content":"..."}].',
        'Make the smallest fix likely to repair npm install or npm run dev.',
        'If no file fix is possible, return an empty array.'
      ].join('\n'),
      prompt: [
        `Task: ${task || ''}`,
        `Command: ${command}`,
        `Exit code: ${error.code}`,
        `stdout:\n${error.stdout || ''}`,
        `stderr:\n${error.stderr || error.error || ''}`,
        `Plan:\n${JSON.stringify(plan || {}, null, 2)}`,
        `package.json:\n${readIfExists(this.workspaceRoot, 'package.json')}`,
        `index.js:\n${readIfExists(this.workspaceRoot, 'index.js')}`,
        `next.config.js:\n${readIfExists(this.workspaceRoot, 'next.config.js')}`
      ].join('\n\n')
    });

    if (Array.isArray(files) && files.length > 0) {
      const writer = new FileWriterAgent(this.workspaceRoot, { generateJson: async () => files }, { permissions: { fileWrite: true } });
      await writer.generateAndWrite({ summary: 'fix', steps: [] }, 'fix failed command');
    } else {
      console.log('[KLAW][FIXER] No file changes returned');
    }

    console.log(`[KLAW][FIXER] Retrying once: ${command}`);
    return runner();
  }
}

module.exports = FixerAgent;
