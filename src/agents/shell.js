const { spawn } = require('child_process');
const inquirer = require('inquirer');

function splitCommand(command) {
  const parts = String(command).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return parts.map((part) => part.replace(/^"|"$/g, ''));
}

class ShellAgent {
  constructor(config = {}) {
    this.permissions = config.permissions || { shell: 'prompt' };
  }

  async allowed(command) {
    if (this.permissions.shell === 'allow') return true;
    if (this.permissions.shell === 'deny') return false;

    const { allow } = await inquirer.prompt([
      { type: 'confirm', name: 'allow', message: `[KLAW][SHELL] Allow command? ${command}` }
    ]);
    return allow;
  }

  async run(command, { cwd = process.cwd(), reason = 'Run command', stream = true } = {}) {
    console.log(`[KLAW][SHELL] Command: ${command}`);
    console.log(`[KLAW][SHELL] CWD: ${cwd}`);
    console.log(`[KLAW][SHELL] Reason: ${reason}`);

    if (!(await this.allowed(command))) {
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
      const isDevServer = command.trim() === 'npm run dev';
      const readyPattern = /(ready|local:|localhost:|started server|compiled successfully)/i;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const timeout = isDevServer
        ? setTimeout(() => {
            stderr += '\nKLAW timed out waiting for the dev server to become ready.';
            child.kill();
            console.log('[KLAW][SHELL] Exit code: 124');
            finish({ code: 124, stdout, stderr });
          }, 30000)
        : null;

      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (stream) process.stdout.write(text);
        if (isDevServer && readyPattern.test(stdout)) {
          setTimeout(() => {
            if (timeout) clearTimeout(timeout);
            child.kill();
            console.log('[KLAW][SHELL] Dev server started successfully; stopping verification process.');
            console.log('[KLAW][SHELL] Exit code: 0');
            finish({ code: 0, stdout, stderr, started: true });
          }, 1500);
        }
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (stream) process.stderr.write(text);
      });

      child.on('error', (error) => {
        if (timeout) clearTimeout(timeout);
        stderr += error.message;
        console.log(`[KLAW][SHELL] Error: ${error.message}`);
        finish({ code: 1, stdout, stderr, error: error.message });
      });

      child.on('close', (code) => {
        if (timeout) clearTimeout(timeout);
        if (settled) return;
        console.log(`[KLAW][SHELL] Exit code: ${code}`);
        finish({ code, stdout, stderr });
      });
    });
  }
}

module.exports = ShellAgent;
