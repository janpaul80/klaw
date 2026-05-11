const fs = require('fs');
const { appendMemory } = require('../memory');
const path = require('path');

function isValidPath(workspaceRoot, targetPath) {
  const resolved = path.resolve(workspaceRoot, targetPath);
  return resolved.startsWith(path.resolve(workspaceRoot));
}

function backupFile(filePath) {
  if (fs.existsSync(filePath)) {
    const backupPath = `${filePath}.bak`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`[KLAW][WRITER] Backup: ${filePath} -> ${backupPath}`);
  }
}

class FileWriterAgent {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
  }

  write(filePath, content) {
    const fullPath = path.join(this.workspaceRoot, filePath);

    if (!isValidPath(this.workspaceRoot, filePath)) {
      console.log(`[KLAW][WRITER] Path outside workspace: ${filePath}`);
      return;
    }

    backupFile(fullPath);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    console.log(`[KLAW][WRITER] Created: ${filePath}`);

    appendMemory('file', `Created ${filePath}`);
  }
}

module.exports = FileWriterAgent;