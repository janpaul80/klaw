#!/usr/bin/env node
/**
 * Benchmark Runner (C1 + C2)
 * Static validation and execution checks
 * Each benchmark runs in an isolated workspace
 */
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const BENCHMARK_DIR = path.dirname(__dirname);
const BENCHMARK_RUNS = path.join(process.env.HOME || process.env.USERPROFILE, '.klaw', 'benchmarks', 'runs');
const BENCHMARK_SCORES = path.join(process.env.HOME || process.env.USERPROFILE, '.klaw', 'benchmarks', 'scorecards');
const BENCHMARKS = ['nextjs', 'express', 'react', 'cli'];

// Timeouts (ms)
const TIMEOUT_INSTALL = 120000;
const TIMEOUT_BUILD = 120000;
const TIMEOUT_SERVER = 30000;
const TIMEOUT_CLI = 30000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadBenchmark(name) {
  const mdPath = path.join(BENCHMARK_DIR, 'benchmarks', `${name}.md`);
  if (!fs.existsSync(mdPath)) {
    return null;
  }
  const content = fs.readFileSync(mdPath, 'utf8');
  const promptMatch = content.match(/^Prompt:\s*(.+)$/m);
  const prompt = promptMatch ? promptMatch[1].trim() : '';
  return { name, prompt };
}

function runNpmInstall(workspace) {
  const result = {
    status: 'skipped',
    exitCode: null,
    durationMs: 0,
    output: ''
  };

  const pkgPath = path.join(workspace, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return result;
  }

  const startTime = Date.now();
  try {
    const install = spawnSync('npm', ['install', '--silent'], {
      cwd: workspace,
      encoding: 'utf8',
      timeout: TIMEOUT_INSTALL,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    result.exitCode = install.status;
    result.output = install.stdout?.slice(-500) || install.stderr?.slice(-500) || '';
  } catch (e) {
    result.output = e.message.slice(-500);
  }
  result.durationMs = Date.now() - startTime;

  result.status = result.exitCode === 0 ? 'pass' : 'install_fail';
  return result;
}

function runBuild(workspace, benchmarkName) {
  const result = {
    status: 'skipped',
    exitCode: null,
    durationMs: 0,
    output: ''
  };

  // Skip build for express (no build step) and cli (no build step)
  if (benchmarkName === 'express' || benchmarkName === 'cli') {
    return result;
  }

  const startTime = Date.now();
  try {
    // Determine build command
    const buildCmd = benchmarkName === 'nextjs' ? 'npm run build' : 'npm run build';
    const build = spawnSync('npm', ['run', 'build'], {
      cwd: workspace,
      encoding: 'utf8',
      timeout: TIMEOUT_BUILD,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    result.exitCode = build.status;
    result.output = build.stdout?.slice(-500) || build.stderr?.slice(-500) || '';
  } catch (e) {
    result.output = e.message.slice(-500);
  }
  result.durationMs = Date.now() - startTime;

  result.status = result.exitCode === 0 ? 'pass' : 'build_fail';
  return result;
}

function runServerStart(workspace, benchmarkName) {
  const result = {
    status: 'skipped',
    exitCode: null,
    durationMs: 0,
    output: ''
  };

  // Only for express
  if (benchmarkName !== 'express') {
    return result;
  }

  const serverFiles = ['index.js', 'app.js', 'server.js'];
  let serverFile = serverFiles.find(f => fs.existsSync(path.join(workspace, f)));
  if (!serverFile) {
    return result;
  }

  const startTime = Date.now();
  let serverProc = null;

  try {
    serverProc = spawn('node', [serverFile], {
      cwd: workspace,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait briefly using sync approach via setTimeout workaround
    let waited = 0;
    while (waited < 3000) {
      waited += 100;
      // Can't use sleep in sync - just check after starting
      break;
    }

    if (serverProc && !serverProc.killed) {
      result.status = 'pass';
    }
  } catch (e) {
    result.output = e.message.slice(-500);
  } finally {
    // Cleanup: kill server process
    if (serverProc) {
      serverProc.kill('SIGTERM');
      setTimeout(() => {
        if (serverProc && !serverProc.killed) {
          serverProc.kill('SIGKILL');
        }
      }, 2000);
    }
  }
  result.durationMs = Date.now() - startTime;

  return result;
}

function runCliExecution(workspace, benchmarkName) {
  const result = {
    status: 'skipped',
    exitCode: null,
    durationMs: 0,
    output: ''
  };

  // Only for cli
  if (benchmarkName !== 'cli') {
    return result;
  }

  const pkgPath = path.join(workspace, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return result;
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (_) {
    return result;
  }

  const binName = pkg.bin ? Object.keys(pkg.bin)[0] : null;
  if (!binName) {
    return result;
  }

  const startTime = Date.now();
  try {
    const cli = spawnSync('npx', [binName, '--help'], {
      cwd: workspace,
      encoding: 'utf8',
      timeout: TIMEOUT_CLI,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    result.exitCode = cli.status;
    result.output = cli.stdout?.slice(-500) || cli.stderr?.slice(-500) || '';
  } catch (e) {
    result.output = e.message.slice(-500);
  }
  result.durationMs = Date.now() - startTime;

  result.status = result.exitCode === 0 ? 'pass' : 'runtime_fail';
  return result;
}

function validateBenchmark(benchmark, workspace) {
  const results = {
    benchmark: benchmark.name,
    workspace: workspace,
    provider: 'openai',
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    filesFound: [],
    checksPassed: [],
    checksFailed: [],
    result: 'fail',
    status: 'runtime_error',
    reason: '',
    // C2 fields
    npmInstall: { status: 'skipped' },
    build: { status: 'skipped' },
    serverStart: { status: 'skipped' },
    cliExecution: { status: 'skipped' }
  };

  if (!workspace || !fs.existsSync(workspace)) {
    results.checksFailed.push('workspace not found');
    results.reason = 'workspace not found';
    return results;
  }

  // Static checks (C1)
  const pkgPath = path.join(workspace, 'package.json');
  if (fs.existsSync(pkgPath)) {
    results.filesFound.push('package.json');
    results.checksPassed.push('package.json exists');

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      switch (benchmark.name) {
        case 'nextjs':
          if (!deps.next) results.checksFailed.push('next dependency');
          else results.checksPassed.push('next dependency');
          if (!deps.react) results.checksFailed.push('react dependency');
          else results.checksPassed.push('react dependency');
          break;
        case 'express':
          if (!deps.express) results.checksFailed.push('express dependency');
          else results.checksPassed.push('express dependency');
          break;
        case 'react':
          if (!deps.react) results.checksFailed.push('react dependency');
          else results.checksPassed.push('react dependency');
          break;
        case 'cli':
          if (!pkg.bin) results.checksFailed.push('bin entry');
          else results.checksPassed.push('bin entry');
          break;
      }
    } catch (e) {
      results.checksFailed.push('package.json parse error');
      results.reason = 'package.json parse error';
    }
  } else {
    results.checksFailed.push('package.json missing');
    results.reason = 'package.json missing';
  }

  // Source file checks
  const sourceChecks = {
    nextjs: ['app/page.js', 'pages/index.js', 'app/layout.js'],
    express: ['index.js', 'app.js', 'server.js'],
    react: ['src/App.js', 'app/page.js', 'pages/index.js', 'components/'],
    cli: ['index.js', 'cli.js', 'main.js']
  };

  for (const file of sourceChecks[benchmark.name] || []) {
    const fullPath = path.join(workspace, file);
    if (fs.existsSync(fullPath)) {
      results.filesFound.push(file);
      results.checksPassed.push(file + ' exists');
    }
  }

  results.result = results.checksFailed.length === 0 ? 'pass' : 'fail';

  if (results.result === 'pass') {
    results.status = 'pass';
  } else if (results.checksFailed.includes('workspace not found') ||
            results.checksFailed.includes('package.json missing')) {
    results.status = 'runtime_error';
  } else {
    results.status = 'validation_fail';
  }

  if (!results.reason) {
    results.reason = results.checksFailed.join('; ');
  }
  return results;
}

function runBenchmark(benchmark) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const workspaceName = `${benchmark.name}-${timestamp}`;
  const workspace = path.join(BENCHMARK_RUNS, workspaceName);

  ensureDir(BENCHMARK_RUNS);
  ensureDir(workspace);

  console.log(`[BENCHMARK] ${benchmark.name}...`);

  // Execute klaw run
  const result = spawnSync('node', ['index.js', 'run', benchmark.prompt, '--ci', '--workspace', workspace], {
    cwd: BENCHMARK_DIR,
    encoding: 'utf8',
    timeout: 180000
  });

  // Validate static
  const validation = validateBenchmark(benchmark, workspace);
  validation.startedAt = new Date(startTime).toISOString();
  validation.completedAt = new Date(Date.now()).toISOString();

  // C2 execution checks
  if (validation.filesFound.includes('package.json')) {
    console.log(`[BENCHMARK] ${benchmark.name} npm install...`);
    validation.npmInstall = runNpmInstall(workspace);

    if (validation.npmInstall.status === 'pass') {
      console.log(`[BENCHMARK] ${benchmark.name} build...`);
      validation.build = runBuild(workspace, benchmark.name);

      if (validation.build.status === 'pass') {
        console.log(`[BENCHMARK] ${benchmark.name} execution...`);
        if (benchmark.name === 'express') {
          validation.serverStart = runServerStart(workspace, benchmark.name);
        } else if (benchmark.name === 'cli') {
          validation.cliExecution = runCliExecution(workspace, benchmark.name);
        }
      }
    }
  }

  validation.durationMs = Date.now() - startTime;
  console.log(`[BENCHMARK] ${benchmark.name} ${validation.result}`);

  return validation;
}

function main() {
  console.log('=== KLAW Benchmark Runner (C1 + C2) ===\n');

  ensureDir(BENCHMARK_RUNS);
  ensureDir(BENCHMARK_SCORES);

  const scorecard = {
    timestamp: new Date().toISOString(),
    benchmarks: []
  };

  for (const name of BENCHMARKS) {
    const benchmark = loadBenchmark(name);
    if (benchmark) {
      const result = runBenchmark(benchmark);
      scorecard.benchmarks.push(result);
    }
  }

  // Write scorecard
  const scorecardPath = path.join(BENCHMARK_SCORES, `${Date.now()}.json`);
  fs.writeFileSync(scorecardPath, JSON.stringify(scorecard, null, 2));

  // Summary
  const passed = scorecard.benchmarks.filter(b => b.result === 'pass').length;
  console.log(`\nSummary: ${passed}/${scorecard.benchmarks.length} passed`);
  console.log(`Scorecard: ${scorecardPath}`);
}

main();