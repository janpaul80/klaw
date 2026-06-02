const { OpenAIProvider } = require('./openai');
const { OllamaProvider } = require('./ollama');
const { AnthropicProvider } = require('./anthropic');
const { LangdockProvider } = require('./langdock');
const { GeminiProvider } = require('./gemini');
const { OpenRouterProvider } = require('./openrouter');

const PROVIDERS = {
  openai: OpenAIProvider,
  ollama: OllamaProvider,
  anthropic: AnthropicProvider,
  langdock: LangdockProvider,
  gemini: GeminiProvider,
  openrouter: OpenRouterProvider
};

function createProvider(config) {
  const providerName = config.provider || 'openai';
  const ProviderClass = PROVIDERS[providerName];
  if (!ProviderClass) {
    const available = Object.keys(PROVIDERS).join(', ');
    throw new Error(`Provider "${providerName}" not supported. Available: ${available}`);
  }
  return new ProviderClass({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens
  });
}

module.exports = { createProvider, PROVIDERS };