const fs = require('fs');
const path = require('path');
const { appendMemory } = require('../memory');

function isValidPath(workspaceRoot, targetPath) {
  const resolved = path.resolve(workspaceRoot, targetPath);
  const root = path.resolve(workspaceRoot);
  return resolved === root || resolved.startsWith(root + path.sep);
}

function backupFile(filePath) {
  if (fs.existsSync(filePath)) {
    const backupPath = `${filePath}.bak`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`[KLAW][WRITER] Backup: ${filePath} -> ${backupPath}`);
  }
}

class FileWriterAgent {
  constructor(workspaceRoot, provider, config = {}) {
    this.workspaceRoot = workspaceRoot;
    this.provider = provider;
    this.config = config;
  }

  async generateAndWrite(plan, task, step = null) {
    const files = await this.provider.generateJson({
      system: [
        'You are KLAW WriterAgent.',
        'Return only a JSON array of files: [{"path":"package.json","content":"..."}].',
        'Generate complete file contents. Do not use placeholders.',
        'For Next.js apps, create a minimal runnable project with package.json, app/page.js or pages/index.js, and needed config/CSS.'
      ].join('\n'),
      prompt: [
        `Task: ${task}`,
        step ? `Current writer step:\n${JSON.stringify(step, null, 2)}` : '',
        `Plan JSON:\n${JSON.stringify(plan, null, 2)}`
      ].filter(Boolean).join('\n\n')
    });

    if (!Array.isArray(files)) {
      throw new Error('WriterAgent returned an invalid files shape');
    }

    const written = [];
    for (const file of files) {
      if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
        throw new Error('WriterAgent file entries require path and content strings');
      }
      if (this.write(file.path, file.content)) {
        written.push({ path: file.path });
      }
    }
    return written;
  }

  write(filePath, content) {
    if (this.config.permissions && this.config.permissions.fileWrite === false) {
      console.log(`[KLAW][WRITER] File writes disabled by config`);
      return false;
    }

    if (!isValidPath(this.workspaceRoot, filePath)) {
      console.log(`[KLAW][WRITER] Path outside workspace blocked: ${filePath}`);
      return false;
    }

    const fullPath = path.resolve(this.workspaceRoot, filePath);
    backupFile(fullPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    console.log(`[KLAW][WRITER] Wrote: ${filePath}`);
    appendMemory('file', `Wrote ${filePath}`);
    return true;
  }
}

module.exports = FileWriterAgent;
