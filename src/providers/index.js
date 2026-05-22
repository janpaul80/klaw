const { OpenAIProvider } = require('./openai');

function createProvider(config) {
  const provider = config.provider || 'openai';
  if (provider !== 'openai') {
    throw new Error(`Provider "${provider}" is not implemented yet. KLAW v0.2.0 supports openai first.`);
  }
  return new OpenAIProvider({ model: config.model });
}

module.exports = { createProvider };
