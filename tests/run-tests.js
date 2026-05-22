const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { defaultConfig, expandHome, resolveWorkspace } = require('../src/config');
const ArchitectAgent = require('../src/agents/architect');
const FileWriterAgent = require('../src/agents/writer');
const ShellAgent = require('../src/agents/shell');
const FixerAgent = require('../src/agents/fixer');
const { executeTask } = require('../src/runtime');

function tmpDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `klaw-${name}-`));
}

async function testConfigDefaults() {
  const config = defaultConfig();
  assert.strictEqual(config.provider, 'openai');
  assert.strictEqual(config.model, 'gpt-4.1-mini');
  assert.strictEqual(config.workspaceRoot, '~/.klaw/workspaces');
  assert.deepStrictEqual(config.permissions, { shell: 'prompt', fileWrite: true });
  assert.strictEqual(expandHome('~/.klaw/workspaces'), path.join(os.homedir(), '.klaw', 'workspaces'));
}

async function testWorkspaceResolution() {
  const root = tmpDir('root');
  const cwd = tmpDir('cwd');
  const implicit = resolveWorkspace({ workspaceRoot: root }, null, 'build a landing page', cwd);
  assert.ok(implicit.startsWith(root));
  assert.ok(!implicit.startsWith(process.cwd()));

  const explicit = resolveWorkspace({ workspaceRoot: root }, './my-app', 'build a landing page', cwd);
  assert.strictEqual(explicit, path.resolve(cwd, 'my-app'));
}

async function testArchitectUsesProviderJson() {
  const provider = {
    async generateJson() {
      return {
        summary: 'Build a small app',
        steps: [{ agent: 'writer', task: 'Create files', files: ['package.json'] }]
      };
    }
  };
  const plan = await new ArchitectAgent(provider).plan('build app');
  assert.strictEqual(plan.summary, 'Build a small app');
  assert.strictEqual(plan.steps[0].agent, 'writer');
}

async function testWriterCreatesProviderFilesInsideWorkspace() {
  const workspace = tmpDir('writer');
  const provider = {
    async generateJson() {
      return [
        { path: 'package.json', content: '{"name":"demo"}' },
        { path: '../outside.txt', content: 'nope' }
      ];
    }
  };
  const files = await new FileWriterAgent(workspace, provider).generateAndWrite({ summary: 'x', steps: [] }, 'task');
  assert.deepStrictEqual(files.map((file) => file.path), ['package.json']);
  assert.strictEqual(fs.readFileSync(path.join(workspace, 'package.json'), 'utf8'), '{"name":"demo"}');
  assert.strictEqual(fs.existsSync(path.join(workspace, '..', 'outside.txt')), false);
}

async function testShellReturnsExitCodeAndOutput() {
  const shell = new ShellAgent({ permissions: { shell: 'allow' } });
  const result = await shell.run('node -e "console.log(123)"', { cwd: process.cwd(), reason: 'test' });
  assert.strictEqual(result.code, 0);
  assert.match(result.stdout, /123/);

  const failed = await shell.run('node -e "console.error(\'boom\'); process.exit(7)"', { cwd: process.cwd(), reason: 'test' });
  assert.strictEqual(failed.code, 7);
  assert.match(failed.stderr, /boom/);
}

async function testFixerAppliesProviderPatchAndRetriesOnce() {
  const workspace = tmpDir('fixer');
  fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ scripts: { dev: 'node missing.js' } }, null, 2));
  let attempts = 0;
  const provider = {
    async generateJson() {
      return [{ path: 'package.json', content: JSON.stringify({ scripts: { dev: 'node ok.js' } }, null, 2) }];
    }
  };
  const fixer = new FixerAgent(workspace, provider);
  const result = await fixer.fixAndRetry({
    command: 'npm run dev',
    error: { stderr: 'Cannot find module missing.js' },
    runner: async () => {
      attempts += 1;
      return { code: 0, stderr: '', stdout: 'ok' };
    }
  });
  assert.strictEqual(result.code, 0);
  assert.strictEqual(attempts, 1);
  assert.match(fs.readFileSync(path.join(workspace, 'package.json'), 'utf8'), /ok\.js/);
}

async function testRuntimeSuccessWithFakeProvider() {
  const workspace = tmpDir('runtime');
  const provider = {
    calls: 0,
    async generateJson() {
      this.calls += 1;
      if (this.calls === 1) {
        return { summary: 'Create a Node app', steps: [{ agent: 'writer', task: 'Create package and app', files: [] }] };
      }
      return [
        {
          path: 'package.json',
          content: JSON.stringify({ scripts: { dev: 'node index.js' } }, null, 2)
        },
        { path: 'index.js', content: "console.log('hello from klaw');\n" }
      ];
    }
  };

  const result = await executeTask('build a simple app', {
    provider,
    config: { provider: 'openai', model: 'fake', workspaceRoot: workspace, permissions: { shell: 'allow', fileWrite: true } },
    workspace,
    commands: ['npm install', 'npm run dev']
  });
  assert.strictEqual(result.status, 'completed');
  assert.strictEqual(result.commands.length, 2);
  assert.strictEqual(result.commands[0].code, 0);
  assert.strictEqual(result.commands[1].code, 0);
}

async function main() {
  const tests = [
    testConfigDefaults,
    testWorkspaceResolution,
    testArchitectUsesProviderJson,
    testWriterCreatesProviderFilesInsideWorkspace,
    testShellReturnsExitCodeAndOutput,
    testFixerAppliesProviderPatchAndRetriesOnce,
    testRuntimeSuccessWithFakeProvider
  ];

  for (const test of tests) {
    await test();
    console.log(`ok ${test.name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
