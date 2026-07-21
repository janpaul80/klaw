const fs = require('fs');
const os = require('os');
const path = require('path');

const packageJson = require('../package.json');

function defaultConfig() {
  return {
    version: packageJson.version,
    provider: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: '',
    apiKey: '',
    temperature: 0.2,
    maxTokens: 0,
    workspaceRoot: '~/.klaw/workspaces',
    fixer: {
      enabled: true,
      retries: 1
    },
    permissions: {
      shell: 'prompt',
      fileWrite: true
    },
    memory: {
      enabled: true
    }
  };
}

function configPath() {
  return path.join(klawHome(), 'config.json');
}

function klawHome() {
  return process.env.KLAW_HOME ? path.resolve(process.env.KLAW_HOME) : path.join(os.homedir(), '.klaw');
}

function expandHome(value) {
  if (!value) return value;
  if (value === '~') return os.homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function readConfig() {
  const file = configPath();
  if (!fs.existsSync(file)) return defaultConfig();
  const loaded = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    ...defaultConfig(),
    ...loaded,
    fixer: {
      ...defaultConfig().fixer,
      ...(loaded.fixer || {})
    },
    permissions: {
      ...defaultConfig().permissions,
      ...(loaded.permissions || {})
    },
    memory: {
      ...defaultConfig().memory,
      ...(loaded.memory || {})
    }
  };
}

function writeConfig(config = defaultConfig()) {
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
  return file;
}

function slugifyTask(task) {
  const slug = String(task || 'task')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return slug || 'task';
}

function resolveWorkspace(config, workspaceOption, task, cwd = process.cwd()) {
  if (workspaceOption) {
    return path.resolve(cwd, expandHome(workspaceOption));
  }

  const root = path.resolve(cwd, expandHome(config.workspaceRoot || defaultConfig().workspaceRoot));
  return path.join(root, `${new Date().toISOString().replace(/[:.]/g, '-')}-${slugifyTask(task)}`);
}

module.exports = {
  defaultConfig,
  configPath,
  klawHome,
  expandHome,
  readConfig,
  writeConfig,
  resolveWorkspace
};
