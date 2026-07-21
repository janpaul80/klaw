/**
 * Model Context Protocol (MCP) Server for Klaw
 * Implements a lightweight, dependency-free stdio transport handler
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createProvider } = require('../providers');
const { executeTask } = require('../runtime');
const { readConfig, resolveWorkspace, expandHome } = require('../config');
const packageJson = require('../../package.json');

class McpServer {
  constructor() {
    this.buffer = '';
  }

  start() {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      this.buffer += chunk;
      this.processBuffer();
    });

    process.stdin.on('end', () => {
      this.processBuffer();
    });
  }

  processBuffer() {
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line) {
        try {
          const request = JSON.parse(line);
          this.handleRequest(request);
        } catch (e) {
          this.sendError(null, -32700, `Parse error: ${e.message}`);
        }
      }
    }
  }

  async handleRequest(request) {
    const { jsonrpc, method, params, id } = request;

    if (jsonrpc !== '2.0') {
      return this.sendError(id, -32600, 'Invalid request: JSON-RPC version must be 2.0');
    }

    switch (method) {
      case 'initialize':
        return this.sendResult(id, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'klaw-mcp',
            version: packageJson.version
          }
        });

      case 'tools/list':
        return this.sendResult(id, {
          tools: [
            {
              name: 'klaw_run',
              description: 'Run a local coding agent to complete a software development task. The agent plans, generates files, and executes commands inside a local workspace.',
              inputSchema: {
                type: 'object',
                properties: {
                  task: {
                    type: 'string',
                    description: 'The coding or scripting task to complete (e.g. "create a simple API route in express")'
                  },
                  workspace: {
                    type: 'string',
                    description: 'Optional custom workspace path (relative or absolute)'
                  },
                  model: {
                    type: 'string',
                    description: 'Optional model override (e.g. "gpt-4o-mini", "gemini-2.0-flash")'
                  },
                  provider: {
                    type: 'string',
                    description: 'Optional provider override (e.g. "openai", "gemini")'
                  }
                },
                required: ['task']
              }
            },
            {
              name: 'klaw_doctor',
              description: 'Diagnose the local Klaw runtime environment, including Node, Git, npm, provider keys, and workspace status.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            }
          ]
        });

      case 'tools/call':
        if (!params || !params.name) {
          return this.sendError(id, -32602, 'Invalid params: name is required');
        }
        return this.handleToolCall(id, params.name, params.arguments || {});

      case 'ping':
        return this.sendResult(id, {});

      default:
        // Ignore notifications (requests without IDs)
        if (id !== undefined) {
          return this.sendError(id, -32601, `Method not found: ${method}`);
        }
    }
  }

  async handleToolCall(id, toolName, args) {
    if (toolName === 'klaw_doctor') {
      try {
        const report = await this.runDoctorDiagnostics();
        return this.sendResult(id, {
          content: [{ type: 'text', text: report }]
        });
      } catch (err) {
        return this.sendResult(id, {
          isError: true,
          content: [{ type: 'text', text: `Doctor failed: ${err.message}` }]
        });
      }
    }

    if (toolName === 'klaw_run') {
      const { task, workspace, model, provider } = args;
      if (!task) {
        return this.sendError(id, -32602, 'Invalid params: task is required');
      }

      try {
        const config = readConfig();
        // Override with tool call arguments
        if (provider) config.provider = provider;
        if (model) config.model = model;

        // Force fully non-interactive mode for tool execution
        config.permissions.shell = 'allow';
        config.permissions.fileWrite = true;

        const targetWorkspace = resolveWorkspace(config, workspace, task);
        const providerInstance = createProvider(config);

        let output = '';
        const originalWrite = process.stdout.write;

        // Intercept stdout writes to prevent polluting the stdio protocol channel
        process.stdout.write = (chunk) => {
          output += chunk.toString();
          return true;
        };

        let result;
        try {
          result = await executeTask(task, {
            config,
            workspace: targetWorkspace,
            provider: providerInstance,
            nonInteractive: true
          });
        } finally {
          process.stdout.write = originalWrite;
        }

        const report = [
          `[KLAW] Status: ${result.status}`,
          `[KLAW] Workspace: ${result.workspace}`,
          '\n=== Agent Execution Log ===',
          output
        ].join('\n');

        return this.sendResult(id, {
          content: [{ type: 'text', text: report }]
        });
      } catch (err) {
        return this.sendResult(id, {
          isError: true,
          content: [{ type: 'text', text: `Execution failed: ${err.message}` }]
        });
      }
    }

    return this.sendError(id, -32601, `Tool not found: ${toolName}`);
  }

  async runDoctorDiagnostics() {
    const config = readConfig();
    const workspaceRoot = expandHome(config.workspaceRoot);
    const npmVersion = this.getCommandVersion('npm');
    const gitVersion = this.getCommandVersion('git');

    const lines = [
      '=== KLAW Doctor ===',
      `Package: ${packageJson.version}`,
      `OS: ${os.platform()} ${os.release()} (${os.arch()})`,
      `Node: ${process.version}`,
      `npm: ${npmVersion || 'missing'}`,
      `Git: ${gitVersion || 'missing'}`,
      `Provider: ${config.provider}`,
      `Model: ${config.model || 'default'}`,
      `Workspace: ${workspaceRoot}`,
      `Workspace Writable: ${this.isWritable(workspaceRoot) ? 'yes' : 'no'}`
    ];

    return lines.join('\n');
  }

  getCommandVersion(command) {
    try {
      const result = process.platform === 'win32'
        ? spawnSync('cmd.exe', ['/d', '/s', '/c', `${command} --version`], { encoding: 'utf8', timeout: 3000 })
        : spawnSync(command, ['--version'], { shell: false, encoding: 'utf8', timeout: 3000 });
      if (result.status !== 0) return null;
      return String(result.stdout || result.stderr).trim().split(/\r?\n/)[0];
    } catch (_) {
      return null;
    }
  }

  isWritable(directory) {
    try {
      fs.mkdirSync(directory, { recursive: true });
      const probe = path.join(directory, `.klaw-mcp-write-${Date.now()}`);
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      return true;
    } catch (_) {
      return false;
    }
  }

  sendResult(id, result) {
    this.send({ jsonrpc: '2.0', id, result });
  }

  sendError(id, code, message) {
    this.send({ jsonrpc: '2.0', id, error: { code, message } });
  }

  send(message) {
    process.stdout.write(JSON.stringify(message) + '\n');
  }
}

module.exports = { McpServer };
