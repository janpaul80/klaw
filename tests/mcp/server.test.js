/**
 * MCP Server Unit Tests
 */

const { McpServer } = require('../../src/mcp/server');

console.log('=== MCP Server Tests ===\n');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

// Mocking process.stdout to capture responses
let sentMessages = [];
const originalWrite = process.stdout.write;
process.stdout.write = (chunk) => {
  const line = chunk.toString().trim();
  if (line.startsWith('{')) {
    try {
      sentMessages.push(JSON.parse(line));
      return true;
    } catch (_) {}
  }
  return originalWrite.call(process.stdout, chunk);
};

try {
  // Test 1: McpServer Initialization & Handshake
  console.log('Test 1: MCP Server Initialize');
  const server = new McpServer();
  
  server.handleRequest({
    jsonrpc: '2.0',
    method: 'initialize',
    id: 101,
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client' }
    }
  });

  assert(sentMessages.length === 1, 'Expected 1 message to be sent');
  assert(sentMessages[0].id === 101, 'Response ID should match request ID');
  assert(sentMessages[0].result.protocolVersion === '2024-11-05', 'Protocol version should be verified');
  assert(sentMessages[0].result.serverInfo.name === 'klaw-mcp', 'Server name should be klaw-mcp');
  console.log('PASS: MCP Server Initialize successful\n');

  sentMessages = [];

  // Test 2: Tools Listing
  console.log('Test 2: MCP Tools List');
  server.handleRequest({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 102
  });

  assert(sentMessages.length === 1, 'Expected 1 response');
  assert(sentMessages[0].id === 102, 'Response ID matches 102');
  const tools = sentMessages[0].result.tools;
  assert(Array.isArray(tools), 'Tools should be an array');
  assert(tools.some(t => t.name === 'klaw_run'), 'Exposes klaw_run');
  assert(tools.some(t => t.name === 'klaw_doctor'), 'Exposes klaw_doctor');
  console.log('PASS: MCP Tools list correct\n');

  sentMessages = [];

  // Test 3: Unknown Method handling
  console.log('Test 3: MCP Unknown Method handling');
  server.handleRequest({
    jsonrpc: '2.0',
    method: 'unknown/method',
    id: 103
  });

  assert(sentMessages.length === 1, 'Expected 1 response');
  assert(sentMessages[0].id === 103, 'Response ID matches 103');
  assert(sentMessages[0].error !== undefined, 'Expected error block');
  assert(sentMessages[0].error.code === -32601, 'Method not found error code');
  console.log('PASS: Unknown method handled correctly\n');

  sentMessages = [];

  // Test 4: Tool Call for klaw_doctor
  console.log('Test 4: MCP Tool Call for klaw_doctor');
  server.handleRequest({
    jsonrpc: '2.0',
    method: 'tools/call',
    id: 104,
    params: {
      name: 'klaw_doctor',
      arguments: {}
    }
  }).then(() => {
    assert(sentMessages.length === 1, 'Expected 1 response');
    assert(sentMessages[0].id === 104, 'Response ID matches 104');
    assert(sentMessages[0].result.content[0].text.includes('=== KLAW Doctor ==='), 'Contains doctor header');
    console.log('PASS: MCP Tool Call for klaw_doctor works\n');

    console.log('=== All MCP Server Tests Passed ===');
    process.stdout.write = originalWrite;
  }).catch(err => {
    process.stdout.write = originalWrite;
    console.error(`FAIL: Tool call check encountered error: ${err.message}`);
    process.exit(1);
  });

} catch (err) {
  process.stdout.write = originalWrite;
  console.error(`FAIL: ${err.stack}`);
  process.exit(1);
}
