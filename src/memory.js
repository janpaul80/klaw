const fs = require('fs');
const path = require('path');
const { klawHome } = require('./config');

function memoryPath() {
  return path.join(klawHome(), 'memory.md');
}

function ensureMemoryFile(file = memoryPath()) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '# KLAW Execution Log\n\n');
  }
}

function appendMemory(type, content) {
  const file = memoryPath();
  const timestamp = new Date().toISOString();
  ensureMemoryFile(file);
  const entry = `${timestamp} [${String(type).toUpperCase()}] ${content}\n`;
  fs.appendFileSync(file, entry);
}

function appendMemoryBlock(block) {
  const file = memoryPath();
  ensureMemoryFile(file);
  const entry = [
    `## ${block.title}`,
    '',
    `Agent: ${block.agent}`,
    `Time: ${block.timestamp}`,
    '',
    'Reasoning:',
    block.reasoning,
    '',
    'Actions:',
    block.actions,
    '',
    '---',
    ''
  ].join('\n');
  fs.appendFileSync(file, entry);
}

module.exports = { appendMemory, appendMemoryBlock, memoryPath };
