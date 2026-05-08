const fs = require('fs');

function appendMemory(type, content) {
  const memoryFile = './memory.md';
  const timestamp = new Date().toISOString();

  if (!fs.existsSync(memoryFile)) {
    fs.writeFileSync(memoryFile, '# KLAW Execution Log\n\n');
  }

  const entry = `[${timestamp}] ${type.toUpperCase()}: ${content}\n\n`;
  fs.appendFileSync(memoryFile, entry);
}

function appendMemoryBlock(block) {
  const memoryFile = './memory.md';
  const entry = `## ${block.title}\n\nAgent: ${block.agent}\nTime: ${block.timestamp}\n\nReasoning:\n${block.reasoning}\n\nActions:\n${block.actions}\n\n---\n\n`;
  fs.appendFileSync(memoryFile, entry);
}

module.exports = { appendMemory, appendMemoryBlock };