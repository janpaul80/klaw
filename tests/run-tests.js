const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const packageJson = require('../package.json');
const { defaultConfig, expandHome, resolveWorkspace, klawHome } = require('../src/config');
const { OpenAIProvider } = require('../src/providers/openai');
const { appendMemory, memoryPath } = require('../src/memory');
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
  assert.strictEqual(config.version, packageJson.version);
  assert.strictEqual(config.model, 'gpt-4o-mini');
  assert.strictEqual(config.workspaceRoot, '~/.klaw/workspaces');
  assert.deepStrictEqual(config.permissions, { shell: 'prompt', fileWrite: true });
  assert.deepStrictEqual(config.memory, { enabled: true });
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
        projectType: 'node',
        steps: [{ id: 'step-1', agent: 'writer', title: 'Create files', description: 'Create package.json', task: 'Create files', files: ['package.json'], commands: [] }]
      };
    }
  };
  const plan = await new ArchitectAgent(provider).plan('build app');
  assert.strictEqual(plan.summary, 'Build a small app');
  assert.strictEqual(plan.projectType, 'node');
  assert.strictEqual(plan.steps[0].id, 'step-1');
  assert.strictEqual(plan.steps[0].agent, 'writer');
}

async function testArchitectRepairsInvalidPlanOnce() {
  let calls = 0;
  const provider = {
    async generateJson() {
      calls += 1;
      if (calls === 1) return { summary: 'bad', steps: [{ agent: 'writer' }] };
      return {
        summary: 'Repaired plan',
        projectType: 'node',
        steps: [{ id: 'step-1', agent: 'shell', title: 'Run app', description: 'Run node', task: 'Run node', files: [], commands: ['node index.js'] }]
      };
    }
  };
  const plan = await new ArchitectAgent(provider).plan('run node');
  assert.strictEqual(calls, 2);
  assert.strictEqual(plan.steps[0].commands[0], 'node index.js');
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
  const result = await shell.run('node -e "console.log(123)"', { cwd: process.cwd(), reason: 'test', stream: false });
  assert.strictEqual(result.code, 0);
  assert.match(result.stdout, /123/);

  const failed = await shell.run('node -e "console.error(\'boom\'); process.exit(7)"', { cwd: process.cwd(), reason: 'test', stream: false });
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
        return {
          summary: 'Create a Node app',
          projectType: 'node',
          steps: [
            { id: 'step-1', agent: 'writer', title: 'Create app', description: 'Create package and app', task: 'Create package and app', files: ['package.json', 'index.js'], commands: [] },
            { id: 'step-2', agent: 'shell', title: 'Install dependencies', description: 'Install dependencies', task: 'Install', files: [], commands: ['npm install'] },
            { id: 'step-3', agent: 'shell', title: 'Run app', description: 'Run generated app', task: 'Run app', files: [], commands: ['npm run dev'] }
          ]
        };
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

async function testRuntimeHonorsPlanCommands() {
  const workspace = tmpDir('planned-runtime');
  const provider = {
    calls: 0,
    async generateJson() {
      this.calls += 1;
      if (this.calls === 1) {
        return {
          summary: 'Run one planned command',
          projectType: 'node',
          steps: [
            { id: 'step-1', agent: 'writer', title: 'Create script', description: 'Create index.js', task: 'Create index.js', files: ['index.js'], commands: [] },
            { id: 'step-2', agent: 'shell', title: 'Run script', description: 'Run node', task: 'Run node', files: [], commands: ['node index.js'] }
          ]
        };
      }
      return [{ path: 'index.js', content: "console.log('planned command');\n" }];
    }
  };
  const result = await executeTask('run one command', {
    provider,
    config: { provider: 'openai', model: 'fake', workspaceRoot: workspace, permissions: { shell: 'allow', fileWrite: true }, memory: { enabled: false } },
    workspace
  });
  assert.strictEqual(result.status, 'completed');
  assert.deepStrictEqual(result.commands.map((entry) => entry.command), ['node index.js']);
}

async function testMemoryUsesKlawHome() {
  const home = tmpDir('home');
  const previous = process.env.KLAW_HOME;
  process.env.KLAW_HOME = home;
  try {
    appendMemory('task', 'memory home test');
    assert.strictEqual(klawHome(), home);
    assert.strictEqual(memoryPath(), path.join(home, 'memory.md'));
    assert.match(fs.readFileSync(path.join(home, 'memory.md'), 'utf8'), /memory home test/);
    assert.notStrictEqual(memoryPath(), path.join(process.cwd(), 'memory.md'));
  } finally {
    if (previous === undefined) delete process.env.KLAW_HOME;
    else process.env.KLAW_HOME = previous;
  }
}

async function testPublicReadmeIsProfessionalAndPlatformSpecific() {
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  assert.match(readme, /https:\/\/www\.klaw\.at\//);
  assert.match(readme, /OPENAI_API_KEY/);
  assert.match(readme, /npm install -g @phartmann80\/klaw/);
}

async function testLandingPageUsesRealLogoAndInstallSections() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /logo\.png/);
  assert.match(html, /https:\/\/www\.klaw\.at\//);
  assert.match(html, /Local AI runtime/i);
  assert.match(html, /npm install -g @phartmann80\/klaw/);
}

async function testProviderMissingKeyFailsClearly() {
  const provider = new OpenAIProvider({ apiKey: '', model: 'gpt-4.1-mini' });
  await assert.rejects(
    () => provider.generateJson({ system: 'Return JSON', prompt: '{}' }),
    /\[KLAW\]\[PROVIDER\] Missing OPENAI_API_KEY/
  );
}

async function testDoctorAndInitCliOutputAreUseful() {
  const home = tmpDir('cli-home');
  const env = { ...process.env, KLAW_HOME: home };
  const doctor = spawnSync(process.execPath, ['index.js', 'doctor'], { cwd: path.join(__dirname, '..'), env, encoding: 'utf8' });
  assert.strictEqual(doctor.status, 0);
  assert.match(doctor.stdout, new RegExp(`Package: ${packageJson.version.replace(/\./g, '\\.')}`));
  assert.match(doctor.stdout, /OS:/);
  assert.match(doctor.stdout, /Node:/);
  assert.match(doctor.stdout, /npm:/);
  assert.match(doctor.stdout, /OPENAI_API_KEY:/);

  const init = spawnSync(process.execPath, ['index.js', 'init'], { cwd: path.join(__dirname, '..'), env, encoding: 'utf8' });
  assert.strictEqual(init.status, 0);
  assert.match(init.stdout, /Provider: openai/);
  assert.match(init.stdout, /Model: gpt-4o-mini/);
  assert.match(init.stdout, /Next:/);
}

async function testCliModelAndProviderFlags() {
  const home = tmpDir('cli-flags-home');
  const env = { ...process.env, KLAW_HOME: home, OPENAI_API_KEY: 'test-key' };
  const runHelp = spawnSync(process.execPath, ['index.js', 'run', '--help'], { cwd: path.join(__dirname, '..'), env, encoding: 'utf8' });
  assert.strictEqual(runHelp.status, 0);
  assert.match(runHelp.stdout, /--model/);
  assert.match(runHelp.stdout, /--provider/);
}

async function main() {
  const tests = [
    testConfigDefaults,
    testWorkspaceResolution,
    testArchitectUsesProviderJson,
    testArchitectRepairsInvalidPlanOnce,
    testWriterCreatesProviderFilesInsideWorkspace,
    testShellReturnsExitCodeAndOutput,
    testFixerAppliesProviderPatchAndRetriesOnce,
    testRuntimeSuccessWithFakeProvider,
    testRuntimeHonorsPlanCommands,
    testMemoryUsesKlawHome,
    testPublicReadmeIsProfessionalAndPlatformSpecific,
    testLandingPageUsesRealLogoAndInstallSections,
    testProviderMissingKeyFailsClearly,
    testDoctorAndInitCliOutputAreUseful,
    testCliModelAndProviderFlags
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
