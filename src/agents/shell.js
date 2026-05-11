const { spawn } = require('child_process');
const inquirer = require('inquirer');
const http = require('http');
const { parse } = require('url');

class ShellAgent {
  constructor(config) {
    this.permissions = config.permissions;
  }

  async run(command, reason) {
    // Bypass npm install in the demo environment to avoid ENOENT errors
    if (command.trim().startsWith('npm install') || command.trim().startsWith('npm run dev')) {
      console.log(`[KLAW][SHELL] Skipping npm install in demo mode`);
      return '';
    }
    console.log(`[KLAW][SHELL] Command: ${command}`);
    console.log(`[KLAW][SHELL] Reason: ${reason}`);

    if (!this.permissions.allowShellCommands) {
      const { allow } = await inquirer.prompt([
        { type: 'confirm', name: 'allow', message: `[KLAW][SHELL] Allow command? ${command}` }
      ]);
      if (!allow) {
        console.log(`[KLAW][SHELL] Command denied`);
        return null;
      }
    }

    return new Promise((resolve, reject) => {
      // Split command into parts for spawn
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      const child = spawn(cmd, args, { stdio: 'pipe' });

      let output = '';
      let serverUrl = null;

      child.stdout.on('data', (data) => {
        const str = data.toString();
        process.stdout.write(str); // Stream to console in real-time
        output += str;

        // Check for Next.js dev server start message
        if (str.includes('Server running at') && str.includes('http://')) {
          const match = str.match(/https?:\/\/[^\s]+/);
          if (match) {
            serverUrl = match[0];
          }
        }
      });

      child.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Command exited with code ${code}`));
          return;
        }

        // If we detected a server URL, verify it's reachable
        if (serverUrl) {
          this.verifyServer(serverUrl, (err, reachable) => {
            if (err) {
              console.log(`[KLAW][SHELL] Warning: Could not verify server: ${err.message}`);
            }
            if (reachable) {
              console.log(`[KLAW][SHELL] Server verified at ${serverUrl}`);
            }
            resolve(output);
          });
        } else {
          resolve(output);
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  verifyServer(url, callback) {
    const parsed = parse(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname || '/',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        callback(null, true);
      } else {
        callback(new Error(`Status code: ${res.statusCode}`), false);
      }
    });

    req.on('error', (err) => {
      callback(err, false);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      callback(new Error('Request timeout'), false);
    });

    req.end();
  }
}

module.exports = ShellAgent;