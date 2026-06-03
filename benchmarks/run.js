#!/usr/bin/env node
/**
 * Benchmark Runner (C1)
 * Executes static validation on generated workspaces
 * Each benchmark runs in an isolated workspace
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BENCHMARK_DIR = path.dirname(__dirname);
const BENCHMARK_RUNS = path.join(process.env.HOME || process.env.USERPROFILE, '.klaw', 'benchmarks', 'runs');
const BENCHMARK_SCORES = path.join(process.env.HOME || process.env.USERPROFILE, '.klaw', 'benchmarks', 'scorecards');
const BENCHMARKS = ['nextjs', 'express', 'react', 'cli'];

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
    reason: ''
  };

  if (!workspace || !fs.existsSync(workspace)) {
    results.checksFailed.push('workspace not found');
    results.reason = 'workspace not found';
    return results;
  }

  // Check for package.json
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

  // Check for source files
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

  // Determine status
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

  // Execute klaw run with explicit workspace
  const result = spawnSync('node', ['index.js', 'run', benchmark.prompt, '--ci', '--workspace', workspace], {
    cwd: BENCHMARK_DIR,
    encoding: 'utf8',
    timeout: 180000
  });

  const completedAt = Date.now();
  const durationMs = completedAt - startTime;

  // Validate
  const validation = validateBenchmark(benchmark, workspace);
  validation.startedAt = new Date(startTime).toISOString();
  validation.completedAt = new Date(completedAt).toISOString();
  validation.durationMs = durationMs;

  console.log(`[BENCHMARK] ${benchmark.name} ${validation.result}`);

  return validation;
}

function main() {
  console.log('=== KLAW Benchmark Runner (C1) ===\n');

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