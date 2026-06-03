const { spawn } = require('child_process');
const inquirer = require('inquirer');
const { KlawError } = require('../errors/klaw-error');

function splitCommand(command) {
  const parts = String(command).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return parts.map((part) => part.replace(/^"|"$/g, ''));
}

class ShellAgent {
  constructor(config = {}, options = {}) {
    this.permissions = config.permissions || { shell: 'prompt' };
    this.nonInteractive = options.nonInteractive || false;
  }

  async allowed(command) {
    // Explicit allow from config
    if (this.permissions.shell === 'allow') return true;
    if (this.permissions.shell === 'deny') return false;

    // Non-interactive mode: never prompt, fail instead
    if (this.nonInteractive) {
      throw new KlawError({
        code: 'PERMISSION_DENIED',
        provider: 'shell',
        stage: 'command',
        message: `[KLAW][SHELL] Command requires approval in non-interactive mode: ${command}`
      });
    }

    // Interactive mode: prompt user
    const { allow } = await inquirer.prompt([
      { type: 'confirm', name: 'allow', message: `[KLAW][SHELL] Allow command? ${command}` }
    ]);
    return allow;
  }

  async run(command, { cwd = process.cwd(), reason = 'Run command', stream = true } = {}) {
    console.log(`[KLAW][SHELL] Command: ${command}`);
    console.log(`[KLAW][SHELL] CWD: ${cwd}`);
    console.log(`[KLAW][SHELL] Reason: ${reason}`);

    let allowed = false;
    try {
      allowed = await this.allowed(command);
    } catch (error) {
      if (error.code === 'PERMISSION_DENIED') {
        console.log(`[KLAW][SHELL] ${error.message}`);
        return { code: 126, stdout: '', stderr: error.message };
      }
      throw error;
    }

    if (!allowed) {
      console.log('[KLAW][SHELL] Command denied');
      return { code: 126, stdout: '', stderr: 'Command denied by user' };
    }

    return new Promise((resolve) => {
      const [cmd, ...args] = splitCommand(command);
      const child = process.platform === 'win32'
        ? spawn(command, { cwd, shell: true, env: process.env })
        : spawn(cmd, args, { cwd, shell: false, env: process.env });
      let stdout = '';
      let stderr = '';
      let settled = false;
      let detectedPorts = [];

      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const portPattern = /localhost:(\d+)|127\.0\.0\.1:(\d+)|0\.0\.0\.0:(\d+)/gi;
      const detectPorts = (text) => {
        const ports = [];
        let match;
        while ((match = portPattern.exec(text)) !== null) {
          const port = match[1] || match[2] || match[3];
          if (port && !ports.includes(port)) ports.push(port);
        }
        return ports;
      };

      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (stream) process.stdout.write(text);
        detectedPorts = [...new Set([...detectedPorts, ...detectPorts(text)])];
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (stream) process.stderr.write(text);
      });

      child.on('error', (error) => {
        stderr += error.message;
        console.log(`[KLAW][SHELL] Error: ${error.message}`);
        finish({ code: 1, stdout, stderr, error: error.message });
      });

      child.on('close', (code) => {
        if (settled) return;
        console.log(`[KLAW][SHELL] Exit code: ${code}`);
        finish({ code, stdout, stderr, ports: detectedPorts });
      });
    });
  }
}

module.exports = ShellAgent;